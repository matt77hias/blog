---
layout: post
title:  "C++ Wishlist"
date:   2018-01-27
---

This post contains a running list of C++ language features and standard library (i.e. `std`) extensions, I would like to see in future C++ standards (C++20 or beyond).

# Full and partial template specilization for alias templates

[Alias templates](http://en.cppreference.com/w/cpp/language/type_alias) are introduced in C++11. 
They basically extent [typedefs](http://en.cppreference.com/w/cpp/language/typedef) 
(which are equivalent to [type aliases](http://en.cppreference.com/w/cpp/language/type_alias)) by adding a template parameter list.

```c++
// Type alias
// This is equivalent to the less intuitive:
// typedef unsigned int uint
using uint = unsigned int;

// Alias template
template< typename T >
using Vector = std::vector< T >;
```

Suppose we want to specialize the return type of a template function based on the template parameter. 
Then we somehow need to map template parameters to return types. To allow arbitrary mappings, template specialization is required.

Lets assume that we want to convert 32-bit numeric values (unsigned/signed integer values, floating point values) to the corresponding 64-bit numeric values. 
In order to specify this mapping in C++, we can use a class template that will be specialized for each element of the mapping:

```c++
// int32_t, int64_t, uint32_t, uint64_t
#include <cstdint>

//  int32_t maps to  int64_t
// uint32_t maps to uint64_t
//    float maps to double

template< typename T >
struct ReturnType
{
    using type = T;
};

template<>
struct ReturnType< std::int32_t >
{
    using type = std::int64_t;
};

template<>
struct ReturnType< std::uint32_t >
{
    using type = std::uint64_t;
};

template<>
struct ReturnType< float >
{
    using type = double;
};

template< typename T >
using return_t = typename ReturnType< T >::type;

template< typename T >
auto convert(T value) -> return_t< T >
{
    return return_t< T >(value);
}
```

*For a more advanced example, see [resource_manager.hpp](https://github.com/matt77hias/MAGE-v0/blob/master/MAGE/Code/Engine/Rendering/resource/rendering_resource_manager.hpp#L23), 
containing a resource manager that manages mutable/immutable resources of different types through different resource pools of different types via one interface for all resources.*

This code seems pretty verbose for what it actually tries to achieve (e.g., why do we need structs for type mappings?), making our intentions less clear for fellow programmers. 
Ideally, we would like to write something like this:

```c++
// int32_t, int64_t, uint32_t, uint64_t
#include <cstdint>

//  int32_t maps to  int64_t
// uint32_t maps to uint64_t
//    float maps to double

template< typename T >
using return_t = T;

template<>
using return_t< std::int32_t > = std::int64_t;

template<>
using return_t< std::uint32_t > = std::uint64_t;

template<>
using return_t< float > = double;

template< typename T >
auto convert(T value) -> return_t< T >
{
    return return_t< T >(value);
}
```

Unfortunately, (full) specialization of alias templates is not permitted in C++ (<= C++17). 
This also implies that partial specialization of alias templates is not permitted either.

# Partial template specilization for functions and member methods

Assume that we want to create resources in a uniform way by calling a function `Create` 
with a template parameter matching the resource we want to create and 
with a list of arguments matching the constructor of the resource we want to invoke.

If we use [SFINAE](http://en.cppreference.com/w/cpp/language/sfinae) on the return type, we can write the following code:

* **C++11**

```c++
#include <type_traits>
#include <vector>

struct Foo
{
    // Contains various constructors
};
struct Bar
{
    // Contains various constructors
};

std::vector< Foo > g_foos;
std::vector< Bar > g_bars;

template< typename ResourceT, typename... ConstructorArgsT >
typename std::enable_if< std::is_same< Foo, ResourceT >::value, ResourceT& >::type 
    Create(ConstructorArgsT&&... args)
{
    g_foos.emplace_back(std::forward< ConstructorArgsT >(args)...);
    return *g_foos.end();
}

template< typename ResourceT, typename... ConstructorArgsT >
typename std::enable_if< std::is_same< Bar, ResourceT >::value, ResourceT& >::type 
    Create(ConstructorArgsT&&... args)
{
    g_bars.emplace_back(std::forward< ConstructorArgsT >(args)...);
    return *g_bars.end();
}

int main()
{
    auto& foo = Create< Foo >();
    auto& bar = Create< Bar >();
	return 0;
}
```

* **C++14** (using [`std::enable_if_t`](http://en.cppreference.com/w/cpp/types/enable_if))

```c++
#include <type_traits>
#include <vector>

struct Foo
{
    // Contains various constructors
};
struct Bar
{
    // Contains various constructors
};

std::vector< Foo > g_foos;
std::vector< Bar > g_bars;

template< typename ResourceT, typename... ConstructorArgsT >
std::enable_if_t< std::is_same< Foo, ResourceT >::value, ResourceT& > 
    Create(ConstructorArgsT&&... args)
{
    g_foos.emplace_back(std::forward< ConstructorArgsT >(args)...);
    return *g_foos.end();
}

template< typename ResourceT, typename... ConstructorArgsT >
std::enable_if_t< std::is_same< Bar, ResourceT >::value, ResourceT& > 
    Create(ConstructorArgsT&&... args)
{
    g_bars.emplace_back(std::forward< ConstructorArgsT >(args)...);
    return *g_bars.end();
}

int main()
{
    auto& foo = Create< Foo >();
    auto& bar = Create< Bar >();
	return 0;
}
```

* **C++17** (using the new [`std::vector::emplace_back`](http://en.cppreference.com/w/cpp/container/vector/emplace_back) and [`std::is_same_v`](http://en.cppreference.com/w/cpp/types/is_same))

```c++
#include <type_traits>
#include <vector>

struct Foo
{
    // Contains various constructors
};
struct Bar
{
    // Contains various constructors
};

std::vector< Foo > g_foos;
std::vector< Bar > g_bars;

template< typename ResourceT, typename... ConstructorArgsT >
std::enable_if_t< std::is_same_v< Foo, ResourceT >, ResourceT& > 
    Create(ConstructorArgsT&&... args)
{
    return g_foos.emplace_back(std::forward< ConstructorArgsT >(args)...);
}

template< typename ResourceT, typename... ConstructorArgsT >
std::enable_if_t< std::is_same_v< Bar, ResourceT >, ResourceT& > 
    Create(ConstructorArgsT&&... args)
{
    return g_bars.emplace_back(std::forward< ConstructorArgsT >(args)...);
}

int main()
{
    auto& foo = Create< Foo >();
    auto& bar = Create< Bar >();
	return 0;
}
```
**Note** that various [type traits](https://en.cppreference.com/w/cpp/header/type_traits) exist in C++. 
For example: if you rather want collections of pointers instead of values to exploit polymorphism, 
you can use [`std::base_of`](http://en.cppreference.com/w/cpp/types/is_base_of) instead of `std::is_same`.

None of these three versions look very readable or pleasing at all.
If we stick to SFINAE, we will probably have to wait until C++20 which will introduce the `requires` keyword.

Alternatively, we can use C++17's [`if constexpr`](http://en.cppreference.com/w/cpp/language/if):

```c++
#include <type_traits>
#include <vector>

struct Foo
{
    // Contains various constructors
};
struct Bar
{
    // Contains various constructors
};

std::vector< Foo > g_foos;
std::vector< Bar > g_bars;

template< typename ResourceT, typename... ConstructorArgsT >
ResourceT& Create(ConstructorArgsT&&... args)
{
    if constexpr (std::is_same_v< Foo, ResourceT >)
	{
        return g_foos.emplace_back(std::forward< ConstructorArgsT >(args)...);
    } 
    else if constexpr (std::is_same_v< Bar, ResourceT >)
	{
        return g_bars.emplace_back(std::forward< ConstructorArgsT >(args)...);
    } 
}

int main()
{
    auto& foo = Create< Foo >();
    auto& bar = Create< Bar >();
	return 0;
}
```
This looks much more compact, but unfortunately requires us to know all resource types in advance which will not always be the case.

Ideally, we would like to write something like this:

```c++
#include <type_traits>
#include <vector>

struct Foo
{
    // Contains various constructors
};
struct Bar
{
    // Contains various constructors
};

std::vector< Foo > g_foos;
std::vector< Bar > g_bars;

template< typename ResourceT, typename... ConstructorArgsT >
ResourceT& Create(ConstructorArgsT&&... args);

template< typename... ConstructorArgsT >
inline Foo& Create(ConstructorArgsT&&... args)
{
    return g_foos.emplace_back(std::forward< ConstructorArgsT >(args)...);
}

template< typename... ConstructorArgsT >
inline Bar& Create(ConstructorArgsT&&... args)
{
    return g_bars.emplace_back(std::forward< ConstructorArgsT >(args)...);
}

int main()
{
    auto& foo = Create< Foo >();
    auto& bar = Create< Bar >();
	return 0;
}
```

Unfortunately, partial specialization of template functions is not permitted in C++ (<= C++17). 
This is also the case when we want to encapsulate our resource collections inside a class: 
partial specialization of member methods is not permitted in C++ (<= C++17). 

# Anonymous structs
C11 added anonymous unions (originally only a GNU extension) and anonymous structs to the C standard.
C++98 (the first C++ standard) includes anonymous unions but not anonymous structs.

Though, anonymous structs work out-of-the-box with MVC++, gcc and Clang for all C++ standards and are ubiquitous in APIs aiming at both a C and C++ audience, such as the Windows API (try to disable C++ language extensions in the compiler and see for yourself). 
So the only reason I can imagine for not adding anonymous structs to the C++ standard, is that one simply forgot that this language feature is non-standard.

# Integer suffixes

There exist no integer suffix for (un)signed chars and (un)signed shorts. 
Therefore, (implicit/explicit) casts are required to initialize these types:
```c++
int main()
{
    auto a = 1;    //   signed int
    auto b = 2u;   // unsigned int
    auto c = 3l;   //   signed long
    auto d = 4ul;  // unsigned long
    auto e = 5ll;  //   signed long long
    auto f = 6ull; // unsigned long long
    auto g = 7.0f; // float
    auto h = 8.0;  // double
    // Note that we can use capitals as well.
    
    auto i = static_cast<   signed short >(9);
    auto j = static_cast< unsigned short >(10);
    auto k = static_cast<   signed char  >(11);
    auto l = static_cast< unsigned char  >(12);
	
	return 0;
}
```
This can become quite verbose when using simple arithmetic functions:
```c++
#include <algorithm>

int main()
{
    // Assume that this value is not known at compile time...
    auto value  = static_cast< signed short >(9);
    auto result = std::max(i, static_cast< signed short >(5));
	
	return 0;
}
```

# noexcept move constructor and assignment operators in std
Move constructors and move assignment operators should be declared [`noexcept`](http://en.cppreference.com/w/cpp/language/noexcept), especially in the `std`.
Unfortunately, this is not true for all `std` classes:
* [std::function](http://en.cppreference.com/w/cpp/utility/functional/function);
* [std::map](http://en.cppreference.com/w/cpp/container/map/map), [std::unordered_map](http://en.cppreference.com/w/cpp/container/unordered_map/unordered_map), [std::multimap](http://en.cppreference.com/w/cpp/container/multimap/multimap), [std::unordered_multimap](http://en.cppreference.com/w/cpp/container/unordered_multimap/unordered_multimap);
* ...

# noexcept as part of the std::function type
C++17 adds C++11's noexcept to the type system. Though, this is not the case for std::function.
Ideally, we want the compiler to reject the following code:

```c++
#include <functional>

void execute(std::function< void() noexcept > func)
{ 
    func(); 
}

void throwing_func()
{ 
    throw 3; 
}

int main()
{
    execute(throwing_func);
	return 0;
}
```

# Remove and replace [[nodiscard]] with [[maybe_discard]].
I add C++17's `[[nodiscard]]` attribute everywhere it makes sense. For functions returning error codes, the returned value should be used, since I return these codes for a reason and do not intent or allow the continuation of the program without handling them appropriately (where the user may use his preferred programming style: total, normal, defensive, etc.). For functions returning values that could leak resources (allocators) or could break the goal (async) in case of not using them, the returned values should be used.  

Most of the remaining functions or member methods (i.e. getters) that return a value are pure or nearly pure (if no exceptions are thrown or assertions are failed). This last category comprises more than 90% of my codebase. Calling these functions without using the returned value makes no sense and should be dealt with to obtain proper code. So in that sense, I like to be warned or even receive an error in such cases. On the other hand, interfaces become quite verbose since you will nearly see the attribute once in every two functions. 

Ideally C++17 should have broken backwards compatibility by adding the opposite keyword `[[maybe_discarded]]`. Note that this is not strictly breaking backwards compatibility, but merely adds extra warnings to existing codebases. Compilers will always become better at analyzing code, so you should expect more future warnings anyway.

# CPU clock
I really like the [`chrono`](http://en.cppreference.com/w/cpp/chrono) library and more specifically, I like the way it handles different storage types (e.g., integer or floating point) with varying degrees of timestamp precision. The available clocks can only handle wall clock time. I would like to handle kernel and/or user mode time as well, since these are more accurate. *(If you have a Windows operating system, I encourage you to compare the difference for yourself with this [project](https://github.com/matt77hias/Timing/blob/master/Timing/Timing/src/Timing.cpp). More particularly, compare the results obtained after running the program once versus twice at the same time.)*

It would be handy to have a clock that handles kernel and/or user mode timestamps in the `std`, since it could be used on all platforms. The surprising thing is that C++ already has such a clock from its C legacy: [`clock`](http://www.cplusplus.com/reference/ctime/clock/). 

> Returns the processor time consumed by the program.

Unfortunately, there is a rather large caveat when looking at the documentation of Microsoft's implementation of [`clock`](https://msdn.microsoft.com/en-us/library/4e2ess30.aspx):

> The clock function tells how much **wall-clock time** has passed since the CRT initialization during process start. Note that this function does not strictly conform to ISO C, which specifies net CPU time as the return value. To obtain CPU times, use the Win32 [`GetProcessTimes`](https://msdn.microsoft.com/en-us/library/windows/desktop/ms683223(v=vs.85).aspx) function.

The aforementioned `GetProcessTimes` is, as one would guess, only available for Windows operating systems. The `std` leaves us thus empty-handed. But even if C's `clock` worked the way it is supposed to on all platforms, we still need a clock inside `<chrono>` with an interface similar to the other clocks (`std::chrono::system_clock`, `std::chrono::steady_clock`, `std::chrono::high_resolution_clock`).

# Unused values in structured bindings
A typical application of C++17's [structured bindings](http://en.cppreference.com/w/cpp/language/structured_binding) is a [ranged-based for loop](https://en.cppreference.com/w/cpp/language/range-for). Not every value obtained from the structured binding, however, needs to be used. For example: consider that we only want to output the values of a map data structure. 
So we do not care about the keys. Then we can write something like this:

```c++
#include <map>
#include <iostream>

std::map< int, char > g_map;

int main()
{
    g_map = { {0, 'a'}, {1, 'b'}, {2, 'c'} };
    
    for (const auto& [key, value] : g_map)
	{
        (void)key; // Unused
        std::cout << value << std::endl;
    }
	
	return 0;
}
```
Notice that we still need to "use" the key to avoid any warnings regarding unused local variables. 

Ideally, we would like to indicate "don't cares" or wildcards in the identifier list of the structured binding. 
Maybe in a Python kind of fashion:

```c++
#include <map>
#include <iostream>

std::map< int, char > g_map;

int main()
{
    g_map = { {0, 'a'}, {1, 'b'}, {2, 'c'} };
    
    for (const auto& [_, value] : g_map)
	{
        std::cout << value << std::endl;
    }
	
	return 0;
}
```
Of course this will not work since `_` is a valid variable name in C++. 
Alternatively, the [paper](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0144r2.pdf) of structured bindings proposes `std::ignore`, but arguments not to add it to the standard since it is too premature in the absence of pattern matching.

# Pattern matching

# Reflection

# Serialization and deserialization
