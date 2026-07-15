---
layout: post
title:  "🧙 MAGE: Asserts"
date:   2020-08-25
description: ""
---

While browsing Microsoft's public [STL](https://github.com/microsoft/STL) implementation, I noticed to my surprise that the [`assert`](https://en.cppreference.com/w/cpp/error/assert) macro ([`<cassert>`](https://en.cppreference.com/w/cpp/header/cassert)) can be evaluated within a constant-evaluated context (e.g., compile time evaluation). Due to the [relaxing constraints on constexpr functions](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2013/n3652.html), it becomes possible to use [`assert`](https://en.cppreference.com/w/cpp/error/assert) in `constexpr` functions in C++14 (some [custom assert workarounds](http://ericniebler.com/2014/09/27/assert-and-constexpr-in-cxx11/) are possible in C++11). 

```c++
// assert
#include <cassert>

constexpr auto f(int i)
    noexcept -> int
{
    assert(0 <= i); // Ensure i is non-negative integer
    return i;
}

auto main()
    -> int
{
    return f(-1); // Pass negative integer
}
```
[Compiler Explorer](https://godbolt.org/z/vTccnx)

```
output.s: ./example.cpp:6: int f(int): Assertion `0 <= i' failed.
```

This is great! On the one hand, more and more functions can be made `constexpr` as newer C++ standards tend to further relax the constraints and tend to make the already existing functionality of the standard library more `constexpr` as well (e.g., [`std::string`](https://en.cppreference.com/w/cpp/string/basic_string), [`std::vector`](https://en.cppreference.com/w/cpp/container/vector)). On the other hand, my mostly used defensive strategy to validate program correctness depends on asserts checking invariants, pre- and postconditions (as opposed to total and defensive programming).

Unfortunately, MAGE already uses custom asserts (`MAGE_ASSERT`) with logging support through [spdlog](https://github.com/gabime/spdlog), which could not be used in `constexpr` functions. Replacing these with [`assert`](https://en.cppreference.com/w/cpp/error/assert) in `constexpr` functions only is not a viable solution:
* having different assert macros depending on the context is confusing;
* when the given expression to [`assert`](https://en.cppreference.com/w/cpp/error/assert) is not evaluated at compile time in a `constexpr` function, since `constexpr` functions are not guaranteed to be evaluated at compile time, our custom logger is not used;
* [`assert`](https://en.cppreference.com/w/cpp/error/assert) will not be evaluated if the [`NDEBUG`](https://en.cppreference.com/w/c/error/assert) symbol is defined, as is the case for `MAGE_ASSERT`. But the latter is actually implemented using `MAGE_ENSURE`, which guarantees to evaluate the given expression independent of the configuration. No equivalent macro for this exists in the C++ standard library.

```c++
//-----------------------------------------------------------------------------
// Engine Defines: Ensure
//-----------------------------------------------------------------------------

// The expression is guaranteed to be evaluated in all configurations.

#define MAGE_ENSURE(expression, ...)                                          \
	do                                                                        \
	{                                                                         \
		if (not (expression))                                                 \
		{                                                                     \
			::mage::details::LogAssert(#expression,                           \
									   MAGE_SOURCE_LOCATION,                  \
									   __VA_ARGS__);                          \
			MAGE_DEBUG_BREAK;                                                 \
		}                                                                     \
	}                                                                         \
	while(false)
	
//-----------------------------------------------------------------------------
// Engine Defines: Assert
//-----------------------------------------------------------------------------

// The expression is not guaranteed to be evaluated in all configurations.
	
#ifdef MAGE_DEBUG
	#define MAGE_ASSERT MAGE_ENSURE
#else  // MAGE_DEBUG
	#define MAGE_ASSERT MAGE_UNEVALUATED_EXPRESSION
#endif // MAGE_DEBUG
```

Fortunately, C++20 added [std::is_constant_evaluated](https://en.cppreference.com/w/cpp/types/is_constant_evaluated) for the purpose of querying whether a function call occurs within a constant-evaluated context, allowing us to refine the previous macro definitions by explicitly distinguishing between both cases: 

```c++
//-----------------------------------------------------------------------------
// Engine Defines: Ensure
//-----------------------------------------------------------------------------

// The expression is guaranteed to be evaluated in all configurations.

#define MAGE_ENSURE(expression, ...)                                          \
	do                                                                        \
	{                                                                         \
		if (not (expression)) [[unlikely]]                                    \
		{                                                                     \
			if (std::is_constant_evaluated())                                 \
			{                                                                 \
				???;                                                          \
			}                                                                 \
			else                                                              \
			{                                                                 \
				::mage::details::LogAssert(#expression,                       \
										   MAGE_SOURCE_LOCATION,              \
										   __VA_ARGS__);                      \
				MAGE_DEBUG_BREAK;                                             \
			}                                                                 \
		}                                                                     \
	}                                                                         \
	while(false)
```

So what can `MAGE_ENSURE` do inside the constant-evaluated context? We cannot use [`assert`](https://en.cppreference.com/w/cpp/error/assert), as Microsoft's STL for example defines it as:

```c++
#ifdef NDEBUG

    #define assert(expression) ((void)0)

#else

    _ACRTIMP void __cdecl _wassert(
        _In_z_ wchar_t const* _Message,
        _In_z_ wchar_t const* _File,
        _In_   unsigned       _Line
        );

    #define assert(expression) (void)(                                                       \
            (!!(expression)) ||                                                              \
            (_wassert(_CRT_WIDE(#expression), _CRT_WIDE(__FILE__), (unsigned)(__LINE__)), 0) \
        )

#endif
```

It is not possible to define the [`NDEBUG`](https://en.cppreference.com/w/c/error/assert) symbol, include [`<cassert>`](https://en.cppreference.com/w/cpp/header/cassert), define `MAGE_ENSURE` using [`assert`](https://en.cppreference.com/w/cpp/error/assert) and undefine the [`NDEBUG`](https://en.cppreference.com/w/c/error/assert) symbol, as `MAGE_ENSURE` itself is a macro definition that will require the [`NDEBUG`](https://en.cppreference.com/w/c/error/assert) symbol to be defined upon expansion. Furthermore, [`assert`](https://en.cppreference.com/w/cpp/error/assert) does not support [`std::string_view`](https://en.cppreference.com/w/cpp/string/basic_string_view), but requires null-terminated strings.

It is not possible to use [`static_assert`](https://en.cppreference.com/w/cpp/language/static_assert), because that cannot evaluate expressions based on function parameters.

The trick consists of ignoring any logging. For expressions that are not evaluated at compile time, but at runtime instead, we want to redirect the assert messages to our logger. At compile time itself, we can obviously not use that same logger. But should we use a logger or output at all? As long as we guarantee the compilation to fail, the compiler will provide us *some* information about the cause without us having to customize this. The question then becomes, how can we let the compilation fail within a constant-evaluated context? Well, we can try to evaluate something that could never be evaluated within such a context (e.g., non-`constexpr` function). There are many possibilities, but my personal favourite is [`std::abort`](https://en.cppreference.com/w/cpp/utility/program/abort).

```c++
//-----------------------------------------------------------------------------
// Engine Defines: Ensure
//-----------------------------------------------------------------------------

// The expression is guaranteed to be evaluated in all configurations.

#define MAGE_ENSURE(expression, ...)                                          \
	do                                                                        \
	{                                                                         \
		if (not (expression)) [[unlikely]]                                    \
		{                                                                     \
			if (std::is_constant_evaluated())                                 \
			{                                                                 \
				std::abort();                                                 \
			}                                                                 \
			else                                                              \
			{                                                                 \
				::mage::details::LogAssert(#expression,                       \
										   MAGE_SOURCE_LOCATION,              \
										   __VA_ARGS__);                      \
				MAGE_DEBUG_BREAK;                                             \
			}                                                                 \
		}                                                                     \
	}                                                                         \
	while(false)

//-----------------------------------------------------------------------------
// Engine Defines: Assert
//-----------------------------------------------------------------------------

// The expression is not guaranteed to be evaluated in all configurations.

#ifdef MAGE_DEBUG
	#define MAGE_ASSERT MAGE_ENSURE
#else  // MAGE_DEBUG
	#define MAGE_ASSERT MAGE_UNEVALUATED_EXPRESSION
#endif // MAGE_DEBUG
```

In addition, we can define a non-conditional fail macro:

```c++
//-----------------------------------------------------------------------------
// Engine Defines: Fail
//-----------------------------------------------------------------------------

#define MAGE_FAIL(...)                                                        \
	do                                                                        \
	{                                                                         \
		if (std::is_constant_evaluated())                                     \
		{                                                                     \
			std::abort();                                                     \
		}                                                                     \
		else                                                                  \
		{                                                                     \
			::mage::details::LogFail(MAGE_SOURCE_LOCATION, __VA_ARGS__);      \
			MAGE_DEBUG_BREAK;                                                       \
		}                                                                     \
	}                                                                         \
	while(false)
```

Which can be used in `constexpr` enum-to-enum conversion functions:

```c++
[[nodiscard]]
constexpr auto Convert(RasterizerState::FillMode input)
    noexcept -> D3D12_FILL_MODE
{
	switch (input)
	{

	using enum RasterizerState::FillMode;

	case Solid:
		return D3D12_FILL_MODE_SOLID;
	case Wireframe:
		return D3D12_FILL_MODE_WIREFRAME;
	[[unlikely]] default:
		MAGE_FAIL("Invalid rasterization fill mode: {}",
				  underlying_cast(input));
		return {};
	}
}
```

🧙
