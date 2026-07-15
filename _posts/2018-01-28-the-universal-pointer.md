---
layout: post
title:  "The Universal Pointer"
date:   2018-01-28
description: ""
---

# Problem

I want to apply an [Entity–Component–System](https://en.wikipedia.org/wiki/Entity%E2%80%93component%E2%80%93system) architecture to my game engine, [MAGE v0](https://github.com/matt77hias/MAGE-v0).
My scene data includes a dynamic array encapsulating a contiguous block of memory (`std::vector`) that stores components by value for each component type.
That way, I can exploit cache coherence and avoid unnecessary jumps between unrelated memory.
This design imposes two immediate problems that need to be handled properly:
* How do you avoid invalidation of pointers and references when components are deleted from their respective collections? 
Assume a `std::vector` contains three elements. 
If we invoke `std::vector::erase` on the vector by passing an iterator to the second element, 
all the following elements need to be moved (via the move assignment operator) to a lower index to avoid fragmentation.
Thus, the third element will become the second element. The implementation of `std::vector` will handle this for us. 
All pointers and references to the original third element, however, will become invalid (i.e. they will not point or refer anymore to the correct element). 
* How do you avoid invalidation of pointers and references when components are added to their respective collections?
One would expect that adding elements to a `std::vector` would not invalidate pointers or references, since elements will always stay at the same index. 
`std::vector`, however, manages internally a contiguous block of memory of a finite size. When this size is too small to fit the required number of elements, a new block of memory is allocated and all elements will be moved (via in-place construction with the move constructor). 
So if our `std::vector` contains three elements and has a capacity of three elements, adding a fourth will invalidate all pointers and references to elements of this collection.

The first problem can be solved easily by not allowing the removal of elements from a `std::vector`. 
If you want to destroy an element, the element is marked `terminated`. 
If you want to add an element, the elements are iterated until the first `terminated` element is encountered. 
That element will be replaced by the new element. If no `terminated` elements are encountered, a new element is added to the back.
This way elements will always reside at the same index. 
*(If it must be possible to remove elements, you can still use the approach below by adding some extra bookkeeping.)*

The second problem can be solved by using a `std::array` of `std::vector` (which will only be resized once), 
given that we know the maximum number of elements. This way we always assume worst case behavior.

The first and second problem can be solved together by using the index of elements as a handle instead of a pointer or reference to the element.
This approach is prone to error, since the index itself has no clue of the `std::vector` it belongs to. 

Ok, so why not wrap the index and a reference to the `std::vector` in some handle class, then we get even the type of element for free? 
But what if we want to use other collections (such as `std::array` and `std::map`) as well? 
If we just encapsulate the "index" and a reference to the collection, we will obtain various different handle classes.
What if we need to store such handles in the same collection? 
Should we create a common abstract base class on top that provides an abstract function to obtain the raw pointer or reference?
This virtual method will certainly incur some additional cost at runtime.

There is an alternative. We can encapsulate all the data we need inside a [`std::function`](http://en.cppreference.com/w/cpp/utility/functional/function).

# ProxyPtr
I call our universal pointer, `ProxyPtr`, after the [Proxy design pattern](https://en.wikipedia.org/wiki/Proxy_pattern). *(If someone will ever be tempted to add it to the `std`, you may name it std::proxy_ptr inside `<memory>` ;-) )*.

Lets start with the member variables:
```c++
template< typename T >
class ProxyPtr final
{

public:
  
    std::function< T*() > m_getter;
}
```
`ProxyPtr` is a template class containing one public member variable, `m_getter`, which is a `std::function` that will return a pointer to an object of the type of the template parameter. How the `std::function` is supposed to do this is implementation dependent. You can just return a raw pointer to obtain the same expressive power as a raw pointer. Or you can add complete programs as the body of this function. Since, C++ is a [Turing Complete](https://en.wikipedia.org/wiki/Turing_completeness) language, you can basically do anything you want inside the body of this function. This is also the reason, I call it a universal pointer: one cannot create another pointer with more expressive power.

Normally, I would like to avoid public member variables, but as we will see encapsulating `m_getter` is not possible for our `ProxyPtr`. The problem is that some lambda functions which are not visible in the scope of `ProxyPtr` require access to the member variable `m_getter` for casting purposes.

Lets continue with the constructors, destructors and assignment operators. We have an empty constructor that defines `m_getter` to return `nullptr` when invoked:

```c++
ProxyPtr() noexcept 
    : ProxyPtr([]() noexcept -> T*
	{
        return nullptr;
    })
	{}
```
    
We have a constructor accepting an argument of the `nullptr` type, [`nullptr_t`](http://en.cppreference.com/w/cpp/types/nullptr_t) (`typedef decltype(nullptr) nullptr_t;`). This way we can write the following code: `ProxyPtr< Widget > ptr = nullptr;`. We do not need to use the argument itself, since we know that `m_getter` needs to return `nullptr` in this case:

```c++
ProxyPtr(std::nullptr_t) noexcept
    : ProxyPtr()
	{}
```

Furthermore, we provide a constructor accepting a `std::function` and a constructor for commonly used collections such as a C-style array, `std::array` and `std::vector` that will create the `std::function` for us:

```c++
explicit ProxyPtr(std::function< T*() > getter) noexcept
    : m_getter(std::move(getter))
	{}

template< typename ContainerT >
explicit ProxyPtr(ContainerT& container, size_t index) noexcept
    : ProxyPtr([&container, index]() noexcept
	{
        return &container[index];
    })
	{}
```

We provide a copy and move constructor, and a generalized copy and move constructor to facilitate casting from child to base `ProxyPtr`s:

```c++
ProxyPtr(const ProxyPtr& ptr) noexcept
    : m_getter(ptr.m_getter)
	{}
		
ProxyPtr(ProxyPtr&& ptr) noexcept
    : m_getter(std::move(ptr.m_getter))
	{}

template< typename FromT, 
          typename = std::enable_if_t< std::is_convertible_v< FromT*, T* > > >
ProxyPtr(const ProxyPtr< FromT >& ptr) noexcept
    : m_getter(ptr.m_getter)
	{}

template< typename FromT, 
          typename = std::enable_if_t< std::is_convertible_v< FromT*, T* > > >
ProxyPtr(ProxyPtr< FromT >&& ptr) noexcept
    : m_getter(std::move(ptr.m_getter))
	{}
```

The destructor, copy and move assignment operator are defined as follows:

```c++
~ProxyPtr() = default;

ProxyPtr& operator=(const ProxyPtr& ptr) noexcept
{
    m_getter = ptr.m_getter;
    return *this;
}
		
ProxyPtr& operator=(ProxyPtr&& ptr) noexcept
{
    m_getter = std::move(ptr.m_getter);
    return *this;
}
```

Note that all these member methods are declared `noexcept`. `std::function` does not provide `noexcept` copy and move constructors, nor `noexcept` copy and move assignment operators. So we need to define all the above methods ourself (otherwise, we could explicitly use the default ones via `= default`). Obviously, we want a `noexcept` move constructor and move assignment operator. 
But why do we require the remaining methods to be `noexcept`? Since a raw pointer is just a primitive type, it cannot throw exceptions upon construction or assignment. We generalize this raw pointer, so we like to have this behavior as well. 
Furthermore, suppose an exception would be thrown (I encourage you to try to trigger it.) we could not recover anyway. 
Finally, adding `noexcept` will increase the performance, since the call stack does not necessarily need to be unwound, effectively reducing the code size. Our `ProxyPtr` will be fundamental to our design and will be frequently used, making it a good candidate for optimization.

For ease of use, we provide a member method to return a raw pointer (similar to `std::unique_ptr` and `std::shared_ptr`):

```c++
[[nodiscard]]
T* Get() const noexcept
{
    return m_getter();
}
```

We override `operator*` and `operator->` to let `ProxyPtr` obtain pointer like behavior:

```c++
[[nodiscard]]
T& operator*() const noexcept
{
    return *Get();
}

T* operator->() const noexcept
{
    return Get();
}
```

To allow code of the form `if (ptr)` or `if (!ptr)`, we need to allow casting our `ProxyPtr` to `bool`:

```c++
[[nodiscard]]
explicit operator bool() const noexcept
{
    return nullptr != Get();
}
```

To allow `ProxyPtr` comparisons of the same or different types, we provide a generalized `operator==` and `operator!=`:

```c++
template< typename U >
[[nodiscard]]
bool operator==(const ProxyPtr< U >& rhs) const noexcept
{
    return Get() == rhs.Get(); 
}
		
template< typename U >
[[nodiscard]]
bool operator!=(const ProxyPtr< U >& rhs) const noexcept
{
    return !(*this == rhs);
}
```

To avoid needless invocations of our constructor accepting an argument of type `nullptr_t` and to allow both left-hand side and right-hand side comparisons with `nullptr`, we define the following comparison functions:

```c++
template< typename T >
[[nodiscard]]
inline bool operator==(const ProxyPtr< T >& lhs, std::nullptr_t) noexcept
{
    return !bool(lhs);
}

template< typename T >
[[nodiscard]]
inline bool operator!=(const ProxyPtr< T >& lhs, std::nullptr_t) noexcept
{
    return bool(lhs);
}

template< typename T >
[[nodiscard]]
inline bool operator==(std::nullptr_t, const ProxyPtr< T >& rhs) noexcept
{
    return !bool(rhs);
}

template< typename T >
[[nodiscard]]
inline bool operator!=(std::nullptr_t, const ProxyPtr< T >& rhs) noexcept
{
    return bool(rhs);
}
```

Finally, we need to provide a way to apply all kinds of casts to our `ProxyPtr`. 
For example: we want to be able to cast a base `ProxyPtr` to child `ProxyPtr`, similar to a raw pointer.
For this purpose, we provide some functions similar to their equivalents of [`std::shared_ptr`](http://en.cppreference.com/w/cpp/memory/shared_ptr/pointer_cast):

```c++
template< typename ToT, typename FromT >
inline ProxyPtr< ToT > static_pointer_cast(const ProxyPtr< FromT >& ptr) noexcept
{
	return ProxyPtr< ToT >([getter(ptr.m_getter)]() noexcept
	{
		return static_cast< ToT* >(getter());
	});
}

template< typename ToT, typename FromT >
inline ProxyPtr< ToT > static_pointer_cast(ProxyPtr< FromT >&& ptr) noexcept
{
	return ProxyPtr< ToT >([getter(std::move(ptr.m_getter))]() noexcept
	{
		return static_cast< ToT* >(getter());
	});
}

template< typename ToT, typename FromT >
inline ProxyPtr< ToT > dynamic_pointer_cast(const ProxyPtr< FromT >& ptr) noexcept
{
	return ProxyPtr< ToT >([getter(ptr.m_getter)]() noexcept
	{
		return dynamic_cast< ToT* >(getter());
	});
}

template< typename ToT, typename FromT >
inline ProxyPtr< ToT > dynamic_pointer_cast(ProxyPtr< FromT >&& ptr) noexcept
{
	return ProxyPtr< ToT >([getter(std::move(ptr.m_getter))]() noexcept
	{
		return dynamic_cast< ToT* >(getter());
	});
}

template< typename ToT, typename FromT >
inline ProxyPtr< ToT > const_pointer_cast(const ProxyPtr< FromT >& ptr) noexcept
{
	return ProxyPtr< ToT >([getter(ptr.m_getter)]() noexcept
	{
		return const_cast< ToT* >(getter());
	});
}

template< typename ToT, typename FromT >
inline ProxyPtr< ToT > const_pointer_cast(ProxyPtr< FromT >&& ptr) noexcept
{
	return ProxyPtr< ToT >([getter(std::move(ptr.m_getter))]() noexcept
	{
		return const_cast< ToT* >(getter());
	});
}

template< typename ToT, typename FromT >
inline ProxyPtr< ToT > reinterpret_pointer_cast(const ProxyPtr< FromT >& ptr) noexcept
{
	return ProxyPtr< ToT >([getter(ptr.m_getter)]() noexcept
	{
		return reinterpret_cast< ToT* >(getter());
	});
}

template< typename ToT, typename FromT >
inline ProxyPtr< ToT > reinterpret_pointer_cast(ProxyPtr< FromT >&& ptr) noexcept
{
	return ProxyPtr< ToT >([getter(std::move(ptr.m_getter))]() noexcept
	{
		return reinterpret_cast< ToT* >(getter());
	});
}
```
Note that we directly access our `m_getter` member variable inside the capture of the lambdas. This explains the public access modifier.

# References

The `ProxyPtr` was designed for and initially used in [MAGE v0](https://github.com/matt77hias/MAGE-v0/blob/master/MAGE/Code/Engine/Utilities/memory/memory.hpp#L353).
