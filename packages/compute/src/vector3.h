#pragma once
#include <cstdint>
#include <cmath>
#include <vector>
#include <string>

namespace coach {

// A fixed-dimension float vector used for joint landmarks.
// Form templates are arrays of these (e.g. 33 landmarks from MediaPipe).
class Vector3 {
 public:
  float x = 0.0f, y = 0.0f, z = 0.0f, visibility = 0.0f;

  Vector3() = default;
  Vector3(float px, float py, float pz, float pv = 1.0f)
      : x(px), y(py), z(pz), visibility(pv) {}

  // Euclidean distance on x,y,z weighted by visibility (low-vis joints matter less).
  float weightedDistTo(const Vector3& o) const {
    const float w = 0.25f + 0.75f * (visibility * o.visibility);
    const float dx = x - o.x, dy = y - o.y, dz = z - o.z;
    return w * std::sqrt(dx * dx + dy * dy + dz * dz);
  }
};

// Flattened point for the KD-Tree. A "pose snapshot" is dim = 3 * numLandmarks,
// e.g. 99 for 33 landmarks.
struct KDIndexEntry {
  uint64_t id;          // external id (form_template row id)
  int phase;            // 0..4 setup..lockout
  std::vector<float> vec;  // length == dim
};

}  // namespace coach
