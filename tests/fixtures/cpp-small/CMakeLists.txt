cmake_minimum_required(VERSION 3.20)
project(cpp_small CXX)

set(CMAKE_CXX_STANDARD 17)

add_executable(cpp_small src/main.cpp src/util.cpp)
target_include_directories(cpp_small PRIVATE include)
