{
  "targets": [
    {
      "target_name": "compute",
      "sources": ["src/napi/bindings.cpp"],
      "include_dirs": ["src/kdtree", "src/dp"],
      "cflags": ["-O3", "-std=c++17", "-fvisibility=hidden"],
      "cflags_cc": ["-O3", "-std=c++17", "-fvisibility=hidden"]
    }
  ]
}
