package util

import "fmt"

const Prefix = "Hello, "

func Greet(name string) string {
	if name == "" {
		return Prefix + "stranger"
	}
	return fmt.Sprintf("%s%s!", Prefix, name)
}

func internalHelper() string {
	return "hidden"
}
