#include <iostream>
using namespace std;

// Function to calculate the nth Fibonacci number
int fib(int n) {
    if (n <= 1) {
        return n;
    }
    return fib(n - 1) + fib(n - 2);
}

int main() {
    int n;

    // Input: position of the Fibonacci number to calculate
    cin >> n;

    // Output: nth Fibonacci number
    cout<< fib(n) << endl;

    return 0;
}