---
layout: post
title:  "Reducing Shader Binding Dependencies"
date:   2017-09-07
description: ""
---

Constant buffer, shader resource view, sampler and unordered access view variables are bound to [registers](https://msdn.microsoft.com/en-us/library/windows/desktop/dd607359(v=vs.85).aspx) in HLSL of type `b`, `t`, `s` and `u`, respectively. The binding slots of these registers, which must be known at compile-time, are typically explicitly hardcoded in and spread among the various shaders.

This approach, unfortunately, introduces lots of implicit dependencies which are difficult to maintain while the codebase grows. The binding slots of shaders, which belong together, can diverge after refactoring due to replication in the HLSL files. Direct3D bindings in the C++ files can diverge from their associated bindings in the HLSL files. Bindings that need to be persistent accross multiple pipeline passes, could start interfering with non-persistent bindings.

To avoid these situations, we need to centralize the bindings between HLSL files and between HLSL and C++ files while still beining able to resolve the bindings at compile-time. A possible solution is to include a single header file containing all binding information in both our HLSL and C++ files:

```c++
#ifndef HEADER_HLSL // "pragma once" is unfortunately not supported by the HLSL pre-processor
#define HEADER_HLSL

#define MAGE_NVIDIA_WARP_SIZE   32
#define MAGE_AMD_WAFEFRONT_SIZE 64
#define GROUP_SIZE_DEFAULT      16

// ## := pre-processor concatenation operator.
#define CONCAT_REG_B(x) b##x
#define CONCAT_REG_T(x) t##x
#define CONCAT_REG_S(x) s##x
#define CONCAT_REG_U(x) u##x
// Make sure to evaluate the given argument before concatenation.
#define REG_B(x) CONCAT_REG_B(x)
#define REG_T(x) CONCAT_REG_T(x)
#define REG_S(x) CONCAT_REG_S(x)
#define REG_U(x) CONCAT_REG_U(x)

#define SLOT_SAMPLER_FOO 0
#define SLOT_SAMPLER_BAR 1

#define SLOT_CBUFFER_FOO 0
#define SLOT_CBUFFER_BAR 1

#define SLOT_SRV_FOO     0
#define SLOT_SRV_BAR     1

#define SLOT_UAV_FOO     0
#define SLOT_UAV_BAR     1

#endif // HEADER_HLSL
```

Bindings in HLSL files can now be defined as:

```c++
Texture2D< float4 > g_foo_texture : register(REG_T(SLOT_SRV_FOO));
Texture2D< float4 > g_bar_texture : register(REG_T(SLOT_SRV_BAR));
```

This approach reduces the number of implicit binding dependencies. Note that some implicit binding dependencies, however, still remain (e.g., the order of RTVs and UAVs bound to the Output Merger stage, the packing layout of constant buffers, etc.).
