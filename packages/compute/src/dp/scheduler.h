#pragma once
#include <algorithm>
#include <cstdint>
#include <map>
#include <string>
#include <vector>

namespace coach {

// ============================================================
// DYNAMIC SCHEDULER — recalculates a weekly split in ~O(D·n·C)
//   D = days available, n = candidate exercise blocks, C = time cap
// Approach:
//   1. Build "exercise blocks" (exercise + set-group), each with a
//      time cost and a priority-weighted score.
//   2. For every day, solve a 0/1 knapsack over the remaining blocks
//      using DP: dp[time] = max achievable score.
//   3. Greedy-muscle balancing + fatigue constraint per day.
//   4. Emit JSON schedule + global optimality score.
// ============================================================

struct ExerciseBlock {
  std::string name;
  std::string muscle;
  int sets;
  float timePerSetMin;   // minutes
  float priority;        // objective weight (strength/volume/pump)
  float fatigueCost;     // fatigue added to that muscle group
  float timeCostMin() const { return sets * timePerSetMin; }
};

struct DaySlot {
  std::string dayName;
  float capacityMin;     // available minutes that day
  float fatigueBudget;   // max muscle-fatigue units this day
};

struct ScheduleResult {
  float score = 0.0f;
  float theoreticalMax = 1.0f;
  std::string json;      // serialized schedule
};

class DPScheduler {
 public:
  ScheduleResult solve(const std::vector<ExerciseBlock>& blocks,
                       const std::vector<DaySlot>& days,
                       bool adaptive = true) {
    ScheduleResult res;
    res.theoreticalMax = 0.0f;
    for (const auto& b : blocks) res.theoreticalMax += b.priority * b.sets;

    // 1-indexed knapsack: dp[t] = best score using <= t minutes
    std::vector<std::vector<size_t>> assignment(days.size());
    std::vector<bool> used(blocks.size(), false);

    float totalScore = 0.0f;
    std::map<std::string, float> fatigue;

    for (size_t d = 0; d < days.size(); ++d) {
      const float cap = days[d].capacityMin;
      const float fCap = days[d].fatigueBudget;
      std::vector<size_t> candidates;
      for (size_t i = 0; i < blocks.size(); ++i) {
        if (used[i]) continue;
        const ExerciseBlock& b = blocks[i];
        if (fatigue[b.muscle] + b.fatigueCost > fCap) continue;
        if (b.timeCostMin() > cap) continue;
        candidates.push_back(i);
      }

      // Classic 0/1 knapsack DP. C integer → scale to tenths of a minute.
      constexpr int TICK = 10;  // 0.1 min granularity
      const int C = static_cast<int>(cap * TICK) + 1;
      std::vector<int> dp(C, 0);
      std::vector<std::vector<uint8_t>> pick(C, std::vector<uint8_t>(candidates.size(), 0));

      for (size_t ci = 0; ci < candidates.size(); ++ci) {
        const size_t bi = candidates[ci];
        const ExerciseBlock& b = blocks[bi];
        const int w = static_cast<int>(b.timeCostMin() * TICK);
        const int v = static_cast<int>(b.priority * b.sets * 100);  // score in 0.01 units
        for (int t = C - 1; t >= w; --t) {
          if (dp[t - w] + v > dp[t]) {
            dp[t] = dp[t - w] + v;
            pick[t][ci] = 1;
          }
        }
      }

      // Backtrack to reconstruct this day's assignment
      int t = C - 1;
      std::vector<size_t> chosen;
      for (int ci = static_cast<int>(candidates.size()) - 1; ci >= 0; --ci) {
        const size_t bi = candidates[ci];
        const ExerciseBlock& b = blocks[bi];
        const int w = static_cast<int>(b.timeCostMin() * TICK);
        if (pick[t][ci]) {
          chosen.push_back(bi);
          t -= w;
        }
      }

      float dayScore = 0.0f;
      for (const size_t bi : chosen) {
        used[bi] = true;
        const ExerciseBlock& b = blocks[bi];
        fatigue[b.muscle] += b.fatigueCost;
        dayScore += b.priority * b.sets;
      }
      assignment[d] = chosen;
      totalScore += dayScore;
    }

    // Adaptive pass: if a day had spare capacity and blocks remain, add the
    // highest-value unused block that still fits (slack-filling).
    if (adaptive) {
      for (size_t d = 0; d < days.size(); ++d) {
        float usedMin = 0.0f;
        for (const size_t bi : assignment[d]) usedMin += blocks[bi].timeCostMin();
        const float slack = days[d].capacityMin - usedMin;
        if (slack < 1.0f) continue;
        // greedy: pick unused block with best score/min that fits
        size_t best = blocks.size();
        float bestRatio = -1.0f;
        for (size_t i = 0; i < blocks.size(); ++i) {
          if (used[i] || blocks[i].timeCostMin() > slack) continue;
          if (fatigue[blocks[i].muscle] + blocks[i].fatigueCost > days[d].fatigueBudget) continue;
          const float ratio = blocks[i].priority * blocks[i].sets / blocks[i].timeCostMin();
          if (ratio > bestRatio) { bestRatio = ratio; best = i; }
        }
        if (best < blocks.size()) {
          assignment[d].push_back(best);
          used[best] = true;
          fatigue[blocks[best].muscle] += blocks[best].fatigueCost;
          totalScore += blocks[best].priority * blocks[best].sets;
        }
      }
    }

    res.score = res.theoreticalMax > 0.0f ? totalScore / res.theoreticalMax : 0.0f;
    res.json = serialize(blocks, days, assignment);
    return res;
  }

 private:
  static std::string serialize(const std::vector<ExerciseBlock>& blocks,
                               const std::vector<DaySlot>& days,
                               const std::vector<std::vector<size_t>>& assignment) {
    std::string out = "[";
    for (size_t d = 0; d < days.size(); ++d) {
      out += "{\"day\":\"" + days[d].dayName + "\",\"exercises\":[";
      float dayMin = 0.0f;
      bool first = true;
      for (const size_t bi : assignment[d]) {
        if (!first) out += ",";
        first = false;
        dayMin += blocks[bi].timeCostMin();
        out += "{\"name\":\"" + blocks[bi].name + "\",\"muscle\":\"" + blocks[bi].muscle +
               "\",\"sets\":" + std::to_string(blocks[bi].sets) +
               ",\"time_min\":" + fmtFloat(blocks[bi].timeCostMin()) + "}";
      }
      out += "],\"used_min\":" + fmtFloat(dayMin) + "}";
      if (d + 1 < days.size()) out += ",";
    }
    out += "]";
    return out;
  }

  static std::string fmtFloat(float v) {
    char buf[32];
    snprintf(buf, sizeof(buf), "%.1f", v);
    return buf;
  }
};

}  // namespace coach
