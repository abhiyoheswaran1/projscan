from ns_pkg.sub.mod_a import helper_a


def helper_b() -> str:
    return helper_a() + "b"
