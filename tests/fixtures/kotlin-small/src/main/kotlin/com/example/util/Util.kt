package com.example.util

const val PREFIX = "hello"

fun greet(name: String) {
    println("$PREFIX, $name!")
}

fun classify(n: Int): String = when (n) {
    0 -> "zero"
    1, 2 -> "small"
    else -> "other"
}

private fun privateHelper(): Int = 42
