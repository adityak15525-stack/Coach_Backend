// ============================================================
// N-API bindings — expose the C++ KD-Tree + DP scheduler to Node.
// Built with plain N-API (node_api.h), zero external deps.
//
// Exports:
//   buildIndex(dim, points, ids, phases) -> indexId
//   destroyIndex(indexId)
//   nn(indexId, query)            -> {distance,id,phase}
//   knn(indexId, query, k)        -> [{distance,id,phase},...]
//   within(indexId, query, radius)-> [id,...]
//   optimizeSplit(blocksJson, daysJson) -> {score,json}
//   bench(n, dim, k)              -> sub-50ms latency proof
// ============================================================
#include <node_api.h>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <limits>
#include <memory>
#include <string>
#include <unordered_map>
#include <vector>

#include "../kdtree/kd_tree.h"
#include "../dp/scheduler.h"

namespace {

using coach::KDTree;
using coach::KDIndexEntry;
using coach::DPScheduler;
using coach::ExerciseBlock;
using coach::DaySlot;

std::unordered_map<int64_t, std::shared_ptr<KDTree>> g_trees;
int64_t g_next_id = 1;

// ---------- helpers ----------
napi_status set_uint32(napi_env env, napi_value obj, const char* key, uint32_t v) {
  napi_value val;
  napi_create_uint32(env, v, &val);
  return napi_set_named_property(env, obj, key, val);
}

napi_status set_double(napi_env env, napi_value obj, const char* key, double v) {
  napi_value val;
  napi_create_double(env, v, &val);
  return napi_set_named_property(env, obj, key, val);
}

std::vector<float> read_float_array(napi_env env, napi_value arr) {
  std::vector<float> out;
  bool is_typed = false;
  napi_is_typedarray(env, arr, &is_typed);
  if (is_typed) {
    napi_typedarray_type type;
    size_t len;
    void* data;
    napi_value buf;
    size_t off;
    napi_get_typedarray_info(env, arr, &type, &len, &data, &buf, &off);
    if (type == napi_float64_array) {
      double* p = static_cast<double*>(data);
      out.assign(p, p + len);
    } else if (type == napi_float32_array) {
      float* p = static_cast<float*>(data);
      out.assign(p, p + len);
    }
    return out;
  }
  uint32_t len;
  napi_get_array_length(env, arr, &len);
  out.reserve(len);
  for (uint32_t i = 0; i < len; ++i) {
    napi_value v;
    napi_get_element(env, arr, i, &v);
    double d;
    napi_get_value_double(env, v, &d);
    out.push_back(static_cast<float>(d));
  }
  return out;
}

// ---------- buildIndex ----------
napi_value build_index(napi_env env, napi_callback_info info) {
  size_t argc = 4;
  napi_value argv[4];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);

  uint32_t dim;
  napi_get_value_uint32(env, argv[0], &dim);

  uint32_t n;
  napi_get_array_length(env, argv[1], &n);

  std::vector<KDIndexEntry> entries;
  entries.reserve(n);
  for (uint32_t i = 0; i < n; ++i) {
    napi_value pt;
    napi_get_element(env, argv[1], i, &pt);
    std::vector<float> vec = read_float_array(env, pt);
    vec.resize(dim, 0.0f);

    napi_value idv, phv;
    napi_get_element(env, argv[2], i, &idv);
    napi_get_element(env, argv[3], i, &phv);
    uint64_t id = 0;
    int32_t ph = 0;
    napi_get_value_int64(env, idv, reinterpret_cast<int64_t*>(&id));
    napi_get_value_int32(env, phv, &ph);
    entries.push_back({id, ph, std::move(vec)});
  }

  auto tree = std::make_shared<KDTree>(std::move(entries), dim);
  const int64_t idx = g_next_id++;
  g_trees[idx] = tree;

  napi_value out;
  napi_create_int64(env, idx, &out);
  return out;
}

// ---------- destroyIndex ----------
napi_value destroy_index(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  int64_t idx;
  napi_get_value_int64(env, argv[0], &idx);
  g_trees.erase(idx);
  napi_value undef;
  napi_get_undefined(env, &undef);
  return undef;
}

// ---------- nn ----------
napi_value nn(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value argv[2];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  int64_t idx;
  napi_get_value_int64(env, argv[0], &idx);
  auto it = g_trees.find(idx);
  if (it == g_trees.end()) {
    napi_value out;
    napi_create_object(env, &out);
    set_double(env, out, "distance", std::numeric_limits<double>::infinity());
    napi_value idv;
    napi_create_int64(env, 0, &idv);
    napi_set_named_property(env, out, "id", idv);
    set_uint32(env, out, "phase", 0xffffffffu);
    return out;
  }
  std::vector<float> q = read_float_array(env, argv[1]);
  auto r = it->second->nearest(q);

  napi_value out;
  napi_create_object(env, &out);
  set_double(env, out, "distance", r.distance);
  napi_value idv;
  napi_create_int64(env, static_cast<int64_t>(r.id), &idv);
  napi_set_named_property(env, out, "id", idv);
  set_uint32(env, out, "phase", static_cast<uint32_t>(r.phase));
  return out;
}

// ---------- knn ----------
napi_value knn(napi_env env, napi_callback_info info) {
  size_t argc = 3;
  napi_value argv[3];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  int64_t idx;
  napi_get_value_int64(env, argv[0], &idx);
  auto it = g_trees.find(idx);
  if (it == g_trees.end()) {
    napi_value arr;
    napi_create_array_with_length(env, 0, &arr);
    return arr;
  }
  std::vector<float> q = read_float_array(env, argv[1]);
  uint32_t k;
  napi_get_value_uint32(env, argv[2], &k);

  auto res = it->second->knn(q, k);
  napi_value arr;
  napi_create_array_with_length(env, res.size(), &arr);
  for (size_t i = 0; i < res.size(); ++i) {
    napi_value obj;
    napi_create_object(env, &obj);
    set_double(env, obj, "distance", res[i].distance);
    napi_value idv;
    napi_create_int64(env, static_cast<int64_t>(res[i].id), &idv);
    napi_set_named_property(env, obj, "id", idv);
    set_uint32(env, obj, "phase", static_cast<uint32_t>(res[i].phase));
    napi_set_element(env, arr, i, obj);
  }
  return arr;
}

// ---------- within ----------
napi_value within(napi_env env, napi_callback_info info) {
  size_t argc = 3;
  napi_value argv[3];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  int64_t idx;
  napi_get_value_int64(env, argv[0], &idx);
  auto it = g_trees.find(idx);
  if (it == g_trees.end()) {
    napi_value arr;
    napi_create_array_with_length(env, 0, &arr);
    return arr;
  }
  std::vector<float> q = read_float_array(env, argv[1]);
  double radius;
  napi_get_value_double(env, argv[2], &radius);
  auto ids = it->second->within(q, static_cast<float>(radius));

  napi_value arr;
  napi_create_array_with_length(env, ids.size(), &arr);
  for (size_t i = 0; i < ids.size(); ++i) {
    napi_value v;
    napi_create_int64(env, static_cast<int64_t>(ids[i]), &v);
    napi_set_element(env, arr, i, v);
  }
  return arr;
}

// ---------- optimizeSplit ----------
napi_value optimize_split(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value argv[2];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);

  char buf[1 << 16];
  size_t blen = sizeof(buf), dlen = sizeof(buf);
  napi_get_value_string_utf8(env, argv[0], buf, sizeof(buf), &blen);
  std::string blocks_json(buf, blen);
  napi_get_value_string_utf8(env, argv[1], buf, sizeof(buf), &dlen);
  std::string days_json(buf, dlen);

  // Mini-JSON parser for our known shape — keep it dependency-free and fast.
  std::vector<ExerciseBlock> blocks;
  std::vector<DaySlot> days;

  auto parse_blocks = [&](const std::string& s) {
    size_t i = s.find('[');
    if (i == std::string::npos) return;
    while ((i = s.find('{', i)) != std::string::npos) {
      size_t j = s.find('}', i);
      if (j == std::string::npos) break;
      std::string body = s.substr(i, j - i + 1);
      ExerciseBlock b;
      auto get = [&](const std::string& key, std::string& dst) {
        auto p = body.find("\"" + key + "\":");
        if (p == std::string::npos) return;
        auto q = body.find('"', p + key.size() + 3);
        auto r = body.find('"', q + 1);
        dst = body.substr(q + 1, r - q - 1);
      };
      auto getn = [&](const std::string& key, float& dst) {
        auto p = body.find("\"" + key + "\":");
        if (p == std::string::npos) return;
        auto q = body.find_first_of(",}", p);
        dst = static_cast<float>(std::atof(body.substr(p + key.size() + 3, q - p - key.size() - 3).c_str()));
      };
      get("name", b.name);
      get("muscle", b.muscle);
      float setsF = 1.0f;
      getn("sets", setsF);
      b.sets = std::max(1, static_cast<int>(setsF));
      getn("timePerSetMin", b.timePerSetMin);
      getn("priority", b.priority);
      getn("fatigueCost", b.fatigueCost);
      if (b.timePerSetMin < 0.1f) b.timePerSetMin = 2.0f;
      blocks.push_back(b);
      i = j + 1;
    }
  };
  auto parse_days = [&](const std::string& s) {
    size_t i = s.find('[');
    if (i == std::string::npos) return;
    while ((i = s.find('{', i)) != std::string::npos) {
      size_t j = s.find('}', i);
      if (j == std::string::npos) break;
      std::string body = s.substr(i, j - i + 1);
      DaySlot d;
      auto get = [&](const std::string& key, std::string& dst) {
        auto p = body.find("\"" + key + "\":");
        if (p == std::string::npos) return;
        auto q = body.find('"', p + key.size() + 3);
        auto r = body.find('"', q + 1);
        dst = body.substr(q + 1, r - q - 1);
      };
      auto getn = [&](const std::string& key, float& dst) {
        auto p = body.find("\"" + key + "\":");
        if (p == std::string::npos) return;
        auto q = body.find_first_of(",}", p);
        dst = static_cast<float>(std::atof(body.substr(p + key.size() + 3, q - p - key.size() - 3).c_str()));
      };
      get("day", d.dayName);
      getn("capacityMin", d.capacityMin);
      getn("fatigueBudget", d.fatigueBudget);
      days.push_back(d);
      i = j + 1;
    }
  };
  parse_blocks(blocks_json);
  parse_days(days_json);

  DPScheduler sched;
  auto res = sched.solve(blocks, days);

  napi_value out;
  napi_create_object(env, &out);
  set_double(env, out, "score", res.score);
  napi_value js;
  napi_create_string_utf8(env, res.json.c_str(), res.json.size(), &js);
  napi_set_named_property(env, out, "schedule_json", js);
  napi_value tb;
  napi_create_uint32(env, static_cast<uint32_t>(blocks.size()), &tb);
  napi_set_named_property(env, out, "blocks", tb);
  return out;
}

// ---------- bench: latency proof (sub-50ms) ----------
napi_value bench(napi_env env, napi_callback_info info) {
  size_t argc = 3;
  napi_value argv[3];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  uint32_t n, dim, k;
  napi_get_value_uint32(env, argv[0], &n);
  napi_get_value_uint32(env, argv[1], &dim);
  napi_get_value_uint32(env, argv[2], &k);

  std::vector<KDIndexEntry> entries;
  entries.reserve(n);
  uint32_t seed = 12345;
  for (uint32_t i = 0; i < n; ++i) {
    std::vector<float> v(dim);
    for (uint32_t d = 0; d < dim; ++d) {
      seed = seed * 1103515245u + 12345u;
      v[d] = static_cast<float>((seed >> 16) & 0x7fff) / 32768.0f;
    }
    entries.push_back({i, static_cast<int>(i % 5), std::move(v)});
  }
  auto tree = std::make_shared<KDTree>(std::move(entries), dim);

  std::vector<float> q(dim, 0.5f);
  // warmup
  for (int i = 0; i < 20; ++i) tree->knn(q, k);

  const int iters = 10000;
  auto t0 = std::chrono::high_resolution_clock::now();
  double acc = 0.0;
  for (int i = 0; i < iters; ++i) {
    auto r = tree->knn(q, k);
    acc += r.empty() ? 0.0 : r[0].distance;
  }
  auto t1 = std::chrono::high_resolution_clock::now();
  double ns = std::chrono::duration_cast<std::chrono::nanoseconds>(t1 - t0).count();
  double avg_us = ns / static_cast<double>(iters) / 1000.0;

  napi_value out;
  napi_create_object(env, &out);
  set_double(env, out, "points", n);
  set_double(env, out, "dim", dim);
  set_double(env, out, "k", k);
  set_double(env, out, "avg_query_us", avg_us);
  set_double(env, out, "queries_per_sec", 1e6 / avg_us);
  set_double(env, out, "avg_distance", acc / iters);
  return out;
}

}  // namespace

// ---------- module init ----------
napi_value init(napi_env env, napi_value exports) {
  napi_value fn_build, fn_destroy, fn_nn, fn_knn, fn_within, fn_split, fn_bench;
  napi_create_function(env, "buildIndex", NAPI_AUTO_LENGTH, build_index, nullptr, &fn_build);
  napi_create_function(env, "destroyIndex", NAPI_AUTO_LENGTH, destroy_index, nullptr, &fn_destroy);
  napi_create_function(env, "nn", NAPI_AUTO_LENGTH, nn, nullptr, &fn_nn);
  napi_create_function(env, "knn", NAPI_AUTO_LENGTH, knn, nullptr, &fn_knn);
  napi_create_function(env, "within", NAPI_AUTO_LENGTH, within, nullptr, &fn_within);
  napi_create_function(env, "optimizeSplit", NAPI_AUTO_LENGTH, optimize_split, nullptr, &fn_split);
  napi_create_function(env, "bench", NAPI_AUTO_LENGTH, bench, nullptr, &fn_bench);

  napi_property_descriptor props[] = {
      {"buildIndex", nullptr, nullptr, nullptr, nullptr, fn_build, napi_default, nullptr},
      {"destroyIndex", nullptr, nullptr, nullptr, nullptr, fn_destroy, napi_default, nullptr},
      {"nn", nullptr, nullptr, nullptr, nullptr, fn_nn, napi_default, nullptr},
      {"knn", nullptr, nullptr, nullptr, nullptr, fn_knn, napi_default, nullptr},
      {"within", nullptr, nullptr, nullptr, nullptr, fn_within, napi_default, nullptr},
      {"optimizeSplit", nullptr, nullptr, nullptr, nullptr, fn_split, napi_default, nullptr},
      {"bench", nullptr, nullptr, nullptr, nullptr, fn_bench, napi_default, nullptr},
  };
  napi_define_properties(env, exports, sizeof(props) / sizeof(props[0]), props);
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, init)
