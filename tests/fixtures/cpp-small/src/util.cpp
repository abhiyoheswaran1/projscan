#include "util.h"

std::string greet(const std::string& name) {
    return "hello, " + name + "!";
}

int classify(int n) {
    switch (n) {
        case 0: return 0;
        case 1:
        case 2:
            return 1;
        default:
            return -1;
    }
}
