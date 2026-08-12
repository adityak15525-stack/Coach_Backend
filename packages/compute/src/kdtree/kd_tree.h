#pragma once
#include "../vector3.h"
#include <algorithm>
#include <limits>
#include <queue>
#include <memory>
#include <vector>
#include <cmath>

namespace coach {

// ============================================================
// KD-Tree — balanced median-split, iterative kNN / ball queries.
// Build: O(n log n) via nth_element. Query: ~O(log n) avg.
// Specialized for pose vectors (all dims have equal scale after norm).
// ============================================================

class KDTree {
 public:
  struct Node {
    size_t pointIndex;   // index into points_
    int axis;
    float splitVal;
    std::unique_ptr<Node> left, right;
  };

  explicit KDTree(std::vector<KDIndexEntry> points, uint32_t dim)
      : points_(std::move(points)), dim_(dim) {
    if (!points_.empty()) {
      std::vector<size_t> idx(points_.size());
      for (size_t i = 0; i < idx.size(); ++i) idx[i] = i;
      root_ = build(idx, 0);
    }
  }

  // Nearest neighbor → {distance, entryId, phase}
  struct NNResult {
    float distance = std::numeric_limits<float>::max();
    uint64_t id = 0;
    int phase = -1;
  };

  NNResult nearest(const std::vector<float>& query) const {
    NNResult best;
    if (!root_) return best;
    // Iterative DFS with pruning (avoids stack overflow on deep trees).
    struct Frame { const Node* node; };
    std::vector<Frame> stack{Frame{root_.get()}};
    while (!stack.empty()) {
      const Node* node = stack.back().node;
      stack.pop_back();
      while (node) {
        const float& q = query[node->axis];
        const float d = squaredDist(pointVec(node->pointIndex), query);
        if (d < best.distance) {
          best.distance = d;
          best.id = points_[node->pointIndex].id;
          best.phase = points_[node->pointIndex].phase;
        }
        const float diff = q - node->splitVal;
        const Node* nearChild = diff < 0.0f ? node->left.get() : node->right.get();
        const Node* farChild  = diff < 0.0f ? node->right.get() : node->left.get();
        if (farChild && diff * diff < best.distance) stack.push_back(Frame{farChild});
        node = nearChild;
      }
    }
    best.distance = std::sqrt(best.distance);
    return best;
  }

  // k-Nearest neighbors (max-heap of size k). k must be >= 1.
  std::vector<NNResult> knn(const std::vector<float>& query, size_t k) const {
    std::vector<NNResult> out;
    if (!root_ || k == 0) return out;
    struct PQueueItem {
      float dist; uint64_t id; int phase;
      bool operator<(const PQueueItem& o) const { return dist < o.dist; }
    };
    std::priority_queue<PQueueItem> heap;
    std::vector<const Node*> stack{root_.get()};
    while (!stack.empty()) {
      const Node* node = stack.back();
      stack.pop_back();
      while (node) {
        const float d = squaredDist(pointVec(node->pointIndex), query);
        if (heap.size() < k) {
          heap.push({d, points_[node->pointIndex].id, points_[node->pointIndex].phase});
        } else if (d < heap.top().dist) {
          heap.pop();
          heap.push({d, points_[node->pointIndex].id, points_[node->pointIndex].phase});
        }
        const float diff = query[node->axis] - node->splitVal;
        const Node* nearChild = diff < 0.0f ? node->left.get() : node->right.get();
        const Node* farChild  = diff < 0.0f ? node->right.get() : node->left.get();
        if (farChild && (heap.size() < k || diff * diff < heap.top().dist))
          stack.push_back(farChild);
        node = nearChild;
      }
    }
    out.reserve(heap.size());
    while (!heap.empty()) {
      out.push_back({std::sqrt(heap.top().dist), heap.top().id, heap.top().phase});
      heap.pop();
    }
    std::reverse(out.begin(), out.end());  // ascending distance
    return out;
  }

  // All points within radius (ball query). Returns entry ids.
  std::vector<uint64_t> within(const std::vector<float>& query, float radius) const {
    std::vector<uint64_t> out;
    if (!root_) return out;
    const float r2 = radius * radius;
    std::vector<const Node*> stack{root_.get()};
    while (!stack.empty()) {
      const Node* node = stack.back();
      stack.pop_back();
      while (node) {
        if (squaredDist(pointVec(node->pointIndex), query) <= r2)
          out.push_back(points_[node->pointIndex].id);
        const float diff = query[node->axis] - node->splitVal;
        const Node* nearChild = diff < 0.0f ? node->left.get() : node->right.get();
        const Node* farChild  = diff < 0.0f ? node->right.get() : node->left.get();
        if (farChild && diff * diff <= r2) stack.push_back(farChild);
        node = nearChild;
      }
    }
    return out;
  }

  size_t size() const { return points_.size(); }

 private:
  std::vector<KDIndexEntry> points_;
  uint32_t dim_;
  std::unique_ptr<Node> root_;

  std::unique_ptr<Node> build(std::vector<size_t>& idx, int depth) {
    const int axis = static_cast<int>(depth % dim_);
    const size_t mid = idx.size() / 2;
    std::nth_element(idx.begin(), idx.begin() + mid, idx.end(),
                     [&](size_t a, size_t b) { return points_[a].vec[axis] < points_[b].vec[axis]; });
    auto node = std::make_unique<Node>();
    node->pointIndex = idx[mid];
    node->axis = axis;
    node->splitVal = points_[idx[mid]].vec[axis];
    if (mid > 0) {
      std::vector<size_t> left(idx.begin(), idx.begin() + mid);
      node->left = build(left, depth + 1);
    }
    if (mid + 1 < idx.size()) {
      std::vector<size_t> right(idx.begin() + mid + 1, idx.end());
      node->right = build(right, depth + 1);
    }
    return node;
  }

  float squaredDist(const std::vector<float>& a, const std::vector<float>& b) const {
    float acc = 0.0f;
    for (uint32_t i = 0; i < dim_; ++i) {
      const float d = a[i] - b[i];
      acc += d * d;
    }
    return acc;
  }

  const std::vector<float>& pointVec(size_t i) const { return points_[i].vec; }
};

}  // namespace coach
