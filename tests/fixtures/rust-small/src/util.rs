pub const PREFIX: &str = "hello";

pub fn greet(name: &str) {
    println!("{}, {}!", PREFIX, name);
}

pub fn classify(n: i32) -> &'static str {
    match n {
        0 => "zero",
        1 | 2 => "small",
        _ => "other",
    }
}

fn private_helper() -> i32 {
    42
}
