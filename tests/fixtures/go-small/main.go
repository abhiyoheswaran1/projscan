package main

import (
	"fmt"

	"example.com/widget/internal/util"
)

func main() {
	greeting := util.Greet("world")
	fmt.Println(greeting)
}
