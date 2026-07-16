---
layout: post
title:  "The Constructible Array"
date:   2018-08-08
description: ""
---

[MAGE v0](https://github.com/matt77hias/MAGE-v0)'s (mathematical) vector types have come a long way.

# Starting point

Originally, we used separate template classes for vectors of different dimensions (e.g., 1x2, 1x3 and 1x4) with the primitive type (e.g., `F32`, `U32`, `S32`, etc.) as template parameter, using various [alignments](https://en.cppreference.com/w/cpp/language/alignas) (e.g., alignment of template type, [16-byte boundary](https://docs.microsoft.com/en-us/windows/desktop/direct3dhlsl/dx-graphics-hlsl-packing-rules)). These classes provide both explicit and implicit constructors for constructing vectors from vectors with a different dimension and/or template parameter (e.g., vectors may implicitly be converted to vectors with a larger dimension, `F32` vectors may implicitly be converted to `F64` vectors of the same dimension), and overload common arithmetic and logical operators.

# Adding dimension and alignment

A first generalization consists of combining all these different template classes into a single template class by adding two additional template parameters: one for the dimension (`std::size_t`) and one for the alignment (`std::size_t`). The latter can use a default value equal to the alignment of the template parameter (e.g., `alignas(T)`) in case no value is provided by the programmer. This approach supports vectors of arbitrary dimensions similar to the [Tungsten](https://github.com/tunabrain/tungsten/blob/master/src/core/math/Vec.hpp) renderer. Overloaded arithmetic and logical operators will typically require a `for` loop over the coefficients of each dimension. Since the dimension template parameter is known at compile time, these loops can be unrolled by the compilers.

Note that the template class can use a C-style array or `std::array< T, N >` (possibly encapsulating the latter's member methods using proxy member methods as well).

# Separating container from the arithmetic/logic

A second generalization consists of separating the container functionality from the arithmetic/logical functionality (similar to the [MAML](https://github.com/matt77hias/MAML) project). On the one hand, we can think of our vectors rather as packs of data values without imposing any fixed interpretation. This way, the same packing template class and its interface (e.g., constructors, indexing mechanisms, etc.) can be used to store and access color data (e.g., linear RGB, sRGB, XYZ, LogLUV, etc.), geometrical data (e.g., point, normal, direction, plane, etc.) and abstract mathematical data (e.g., real, complex, dual, hyperbolic and quaternion numbers). On the other hand, arithmetic/logical functionality can be implemented using SIMD instructions for better performance: 

1. Load the vector into an SIMD register (e.g., `__m128`);
2. Perform all arithmetic and logical operations using SIMD intrinsics; 
3. Store the result from an SIMD register into some new vector (e.g., cross product) or primitive value (e.g., dot product). 

In our vector classes, we do not want to use `__m128` member variables (e.g., `union`), since this imposes a 16-byte boundary alignment and thus does not support custom alignments, and since the size of not all our vector class template instantiations is a multiple of sizeof(`__m128`), resulting in wasted memory usage. Alternatively, we do not want to perform separate `__m128` conversions upon starting and finishing every elementary arithmetic and logical member method. To reduce the number of instructions and transfers between registers of different type, and thus to obtain the best performance, data should be kept as long as possible into `__m128` variables. Therefore, we will provide separate functions to load vectors to SIMD registers, to store SIMD registers to vectors/primitive values, and to perform various arithmetic and logical operations (e.g., [DirectXMath](https://github.com/Microsoft/DirectXMath)).

# Extending std::array

Since the arithmetic/logical functionality is not a part of our template class any more, our template class seems like a convenient extension of [`std::array`](https://en.cppreference.com/w/cpp/container/array). The latter provides lots of methods supporting nice interoperability with the `std` (e.g., `(c)begin`/`(c)end`, `size`, `empty`). Furthermore `std::array` can be used in range-based for loops and structure bindings.

Unfortunately, `std::array` has no constructors itself, but rather uses [aggregate initialization](https://en.cppreference.com/w/cpp/language/aggregate_initialization). Therefore, constructing vectors from vectors with a different dimension and/or template parameter does not work straight out of the box. To achieve this, we will define a new class `Array` deriving from `std::array`, providing all the necessary constructors. Furthermore, we will provide some additional utility methods to construct and return `std::array`s (using C++17's guaranteed copy elision) which will be passed to the base class `std::array` inside these `Array` constructors.

Construct an `std::array< T, N >` containing `N` elements with the same value:

```c++
namespace details
{

	template< typename T, std::size_t...I >
	constexpr const auto FillArray(const T& value, std::index_sequence< I... >)
	{
		return std::array< T, sizeof...(I) >{ (static_cast< void >(I), value)... };
	}
}

template< typename T, std::size_t N >
constexpr const auto FillArray(const T& value)
{
	return details::FillArray(value, std::make_index_sequence< N >());
}
```

Construct an `std::array< T, ToN >` from a smaller `std::array< T, FromN >` by appending `ToN-FromN` zero-initialized values:

```c++
namespace details
{
	template< std::size_t ToN, typename T, std::size_t...I >
	constexpr const auto EnlargeArray(const std::array< T, sizeof...(I) >& a, 
	                                  std::index_sequence< I... >)
	{
		
		return std::array< T, ToN >{ a[I]... };
	}
}

template< std::size_t ToN, typename T, std::size_t FromN >
constexpr const auto EnlargeArray(const std::array< T, FromN >& a)
{
	return details::EnlargeArray< ToN >(a, std::make_index_sequence< FromN >());
}
```

Construct an `std::array< ToT, N >` from a `std::array< FromT, N >` by transforming (i.e. map function) all elements of the array:

```c++
namespace details
{
	template< typename ActionT, typename FromT, std::size_t...I >
	constexpr const auto TransformArray(ActionT&& action, 
										const std::array< FromT, sizeof...(I) >& a, 
										std::index_sequence< I... >)
	{
		
		using ToT = decltype(std::declval< ActionT >()(std::declval< FromT >()));
		return std::array< ToT, sizeof...(I) >{ action(a[I])... };
	}

	template< typename ToT, typename FromT, std::size_t N >
	constexpr const auto StaticCastArray(const std::array< FromT, N >& a)
	{
		constexpr auto f = [](const FromT& v)
		{
			return static_cast< ToT >(v); 
		};
		return TransformArray(f, a, std::make_index_sequence< N >());
	}
}
```

Convert `std::array< T , N >` to `std::tuple< T, ..., T >` and vice versa:

```c++
namespace details
{
	template< typename T, typename TupleT, std::size_t... I >
	constexpr const auto TuppleToArray(const TupleT& t, std::index_sequence< I... >)
	{
		return std::array< T, sizeof...(I) >{ std::get< I >(t)... };
	}

	template< typename T, std::size_t...I >
	constexpr const auto ArrayToTupple(const std::array< T, sizeof...(I) >& a, 
	                                   std::index_sequence< I... >)
	{
		return std::make_tuple(a[I]...);
	}
}

template< typename T, typename... Ts >
constexpr const auto TuppleToArray(const std::tuple< T, Ts... >& t)
{
	constexpr auto N = sizeof...(Ts) + 1u;
	return details::TuppleToArray< T >(t, std::make_index_sequence< N >());
}

template< typename T, std::size_t N >
constexpr const auto ArrayToTupple(const std::array< T, N >& a)
{
	return details::ArrayToTupple(a, std::make_index_sequence< N >());
}
```

Our `std::array< T, N >` wrapper, `Array< T, N, A >` using inheritance:

```c++
template< typename T, std::size_t N, std::size_t A = alignof(T), 
          typename = std::enable_if_t< (N > 1) > >
struct alignas(A) Array : public std::array< T, N >
{

	public:
		static constexpr std::size_t s_size = N;
		
		constexpr Array() noexcept
			: std::array< T, N >{}
		{}
		
		...
		
		constexpr Array(const Array& a) noexcept = default;
		
		constexpr Array(Array&& a) noexcept = default;

		...

		~Array() = default;
		
		constexpr Array& operator=(const Array& a) noexcept = default;

		constexpr Array& operator=(Array&& a) noexcept = default;
}
```

Besides a template parameter, `T`,  for the type and size, `N`, we also provide a template parameter for the alignment, `A`, which by default uses the alignment of `T`. Furthermore, to facilitate our member method declarations (especially the [SFINAE](https://en.cppreference.com/w/cpp/language/sfinae) usage), we do not support `Array< T, N, A >` with a size, `N`, of zero or one. Arrays with at most one element have no practical use case in isolation, but can be useful as degenerate cases in order to simplify algorithms implemented via template meta programming. We also explicitly store the size as a class member variable to support structure bindings for derived classes.

Construct an `Array< T, N, A >` containing `N` elements with the same value:

```c++
constexpr explicit Array(const T& value) noexcept
	: std::array< T, N >(FillArray< T, N >(value))
	{}
```

Construct an `Array< T, N, A >` containing the `N` given values:

```c++
template< typename... ArgsT, 
          typename = std::enable_if_t< (N == sizeof...(ArgsT)) > >
constexpr Array(ArgsT&&... args) noexcept
	: std::array< T, N >{ std::forward< ArgsT >(args)... }
	{}
```

Construct an `Array< T, N, A >` from a smaller `Array< T, FromN, A >` by appending `N-FromN` zero-initialized values:

```c++
template< std::size_t FromN, 
          typename = std::enable_if_t< (FromN < N) > >
constexpr Array(const Array< T, FromN, A >& a) noexcept
	: std::array< T, N >(EnlargeArray< N >(a))
	{}
```

Construct an `Array< T, N, A >` from a smaller `Array< T, FromN, FromA >` by appending `N-FromN` zero-initialized values:

```c++
template< std::size_t FromN, std::size_t FromA,
          typename = std::enable_if_t< (FromN < N && FromA != A) > >
constexpr explicit Array(const Array< T, FromN, FromA >& a) noexcept
	: std::array< T, N >(EnlargeArray< N >(a))
	{}
```

Note the `explicit` keyword.

Construct an `Array< T, N, A >` from a smaller `Array< T, FromN, A >` and `N-FromN` given values:

```c++
template< std::size_t FromN, typename... ArgsT, 
          typename = std::enable_if_t< (FromN < N && (FromN + sizeof...(ArgsT)) == N) > >
constexpr Array(const Array< T, FromN, A >& a, ArgsT&&... args) noexcept
	: std::array< T, N >(TuppleToArray(std::tuple_cat(ArrayToTupple(a), 
                                                      std::make_tuple(std::forward< ArgsT >(args)...))))
	{}
```

Construct an `Array< T, N, A >` from a smaller `Array< T, FromN, FromA >` and `N-FromN` given values:

```c++
template< std::size_t FromN, std::size_t FromA, typename... ArgsT, 
          typename = std::enable_if_t< (FromN < N && (FromN + sizeof...(ArgsT)) == N && FromA != A) > >
constexpr explicit Array(const Array< T, FromN, FromA >& a, ArgsT&&... args) noexcept
	: std::array< T, N >(TuppleToArray(std::tuple_cat(ArrayToTupple(a), 
                                                      std::make_tuple(std::forward< ArgsT >(args)...))))
	{}
```

Note the `explicit` keyword.

Construct an `Array< T, N, A >` from a `Array< FromT, N, A >` or `Array< FromT, N, FromA >`:

```c++
template< typename FromT, std::size_t FromA, 
          typename = std::enable_if_t< std::is_convertible_v< FromT, T > > >
constexpr explicit Array(const Array< FromT, N, FromA >& a) noexcept
	: std::array< T, N >(StaticCastArray< T >(a))
	{}
```

Note the `explicit` keyword.

Finally, we add structure binding support for our `Array< T, N, A >` in the `std`:

```c++
namespace std
{

	template< typename T, size_t N, size_t A >
	struct tuple_size< Array< T, N, A > >
		: public integral_constant< size_t, N >
	{};

	template< size_t I, typename T, size_t N, size_t A >
	struct tuple_element< I, Array< T, N, A > >
	{
		using type = T;
	};
}
```

# Examples

Try it online:
* [WandBox](https://wandbox.org/permlink/09FzgvqnrLqatvkW)
* [Godbolt](https://tinyurl.com/ybb2lhmn): note the "aggressive" folding of methods in the assembly code :-)

```c++
template< typename T, std::size_t N >
std::ostream& operator<<(std::ostream& os, const std::array< T, N >& a)
{
    for (auto i : a)
	{ 
		os << i << ' '; 
	}
    return os << '\n';
}

int main()
{
    constexpr Array< float, 5 > a;
    std::cout << a; // 0 0 0 0 0
  
    constexpr Array< float, 5 > b( 1.5f, 2.5f, 3.5f, 4.5f, 5.5f );
    std::cout << b; // 1.5 2.5 3.5 4.5 5.5
    
    constexpr Array< float, 5 > c{ 1.5f, 2.5f, 3.5f, 4.5f, 5.5f };
    std::cout << c; // 1.5 2.5 3.5 4.5 5.5
    
    constexpr Array< float, 6 > d(c);
    std::cout << d; // 1.5 2.5 3.5 4.5 5.5 0
    
    constexpr Array< float, 6 > e(c, 6.5f);
	std::cout << e; // 1.5 2.5 3.5 4.5 5.5 6.5
    
    constexpr Array< int, 6 > f(e);
    std::cout << f; // 1 2 3 4 5 6
    
    constexpr Array< int, 6 > g(5);
    std::cout << g; // 5 5 5 5 5 5
    
    constexpr Array< Array< float, 5 >, 5 > h(c);
    std::cout << h;
    // 1.5 2.5 3.5 4.5 5.5 
    // 	1.5 2.5 3.5 4.5 5.5 
    // 	1.5 2.5 3.5 4.5 5.5 
    // 	1.5 2.5 3.5 4.5 5.5 
    // 	1.5 2.5 3.5 4.5 5.5 
    
    return 0;
}
```

# References
The `Array` was designed for and initially used in [MAGE-v0](https://github.com/matt77hias/MAGE-v0/blob/master/MAGE/Code/Engine/Utilities/collection/array.hpp#L127).
