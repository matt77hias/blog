---
layout: post
math: true
title:  "Linear, Gamma and sRGB Color Spaces"
date:   2018-07-01
description: ""
---

*This post is based on a [reply](https://github.com/ocornut/imgui/issues/578#issuecomment-379467586) of mine to an [ImGui](https://github.com/ocornut/imgui/) issue (and discussion) about sRGB and linear color spaces.*

# Gamma color space

The actual color of a pixel, outputted on a monitor, does not linearly depend on the applied voltage signal for that pixel. For CRT monitors, the actual color is approximately proportional to the applied voltage raised to the power of a so-called *gamma* value, which depends on the monitor. This gamma value typically lies between 2.2 and 2.5 for CRT monitors. (*Hence, the ubiquitous appearances of the magical constant 2.2 in rendering applications.*) 

$$L_\mathrm{actual} \sim V^\gamma$$

To bypass this gamma value in your computations, you need to [*gamma correct*](https://en.wikipedia.org/wiki/Gamma_correction) the computed colors of each pixel before presenting. By raising the computed color to a power of the reciprocal of that same gamma value, the computed color becomes proportional to the actual color.

$$V \sim L_\mathrm{computed}^{1/\gamma} \\
L_\mathrm{actual} \sim L_\mathrm{computed}$$

So in general gamma correction is a technique that adapts the computed colors to the transfer function of the monitor used for outputting. Both CRT and non-CRT monitors each have their own transfer function. This means that the final rendering pass should adapt the computed colors, based on the used monitor, to obtain correct actual colors.

These linear-to-gamma color space conversions seem like unnecessary overhead from a monitor construction point of view. It is physically perfectly possible to construct a CRT monitor with a gamma value of exactly one, ensuring that the computed color is already proportional to the actual color, and eliminating the need for gamma correction.

From a perceptual point of view, removing the need for gamma correction and using a monitor where computed colors are proportional to the corresponding actual colors is actually a bad idea. Typically, actual colors are represented with 8 (or 10) bits for each of the red, green and blue channel. This quantization only supports 256 (or 1024) different colors. Here, a 0 value represents completely black and a 255 (or a 1023) value represents completely white. But what about the intermediate values? If a linear encoding is used (i.e. a gamma value of 1), the majority of values would be perceptually very close to white and a very small minority would be perceptually close to black. By using a gamma encoding (e.g., a gamma value of 2.2), the distribution is perceptually more linear (i.e. equidistant intervals between black and white).

<div align="center"><img src="/assets/posts/linear-gamma-and-sRGB-color-spaces/linear-gamma.png"></div>

# sRGB color space

The [sRGB color space](https://en.wikipedia.org/wiki/SRGB) has similar goals, assigning a perceptual linear range of (computed) color values to the available 256 different (actual) color values. A rough approximation of transforming linear to sRGB color values consists of raising to a power of 2.2. A more accurate approximation would distinguish between a more linear correspondence near black and a gamma (2.4) encoding near white. And finally, you can just use the exact transformation between linear and sRGB color space as well. The more accurate, the more expensive the computation will be. 

The sRGB color space is obviously used for sRGB monitors which are primarily used for content creation (e.g., textures, etc.). Images with a R8G8B8A8 format are in most cases represented in sRGB color space and definitely not in linear color space (*as a user, you obviously do not need to guess, but just need to know which color space is used for the encoding*). RGB color pickers typically operate in sRGB color space as well.

# Color operations

Colors represented in linear color space can be mutually added and multiplied. Colors represented in *a* gamma color space cannot be mutually added, but can be mutually multiplied. Colors represented in sRGB color space can neither be mutually added nor multiplied. Note that I explicitly differentiate between a gamma and sRGB color space, since not everyone will use the most cheapest linear-to-sRGB approximation. 

Colors represented in a gamma or sRGB color space cannot be used as vertex attributes during the barycentric interpolation for fragment generation. The color attribute of a vertex needs to be expressed in linear space before passing to the rasterizer stage. The pixel/fragment shader will thus always obtain a fragment color expressed in linear space.

The above applies to vertex attributes; so single color coefficients. But what about textures? For textures there is not a choice. Most textures will contain colors expressed in sRGB color space, and thus these textures should be explicitly encoded as sRGB colors (e.g. `DXGI_FORMAT_..._SRGB`). By using an explicit sRGB texture format, the hardware will perform the sRGB-to-linear conversion when appropriate. So with regard to texture sampling/filtering:

`hardware sRGB-to-linear conversion -> filtering != filtering -> user defined sRGB-to-linear conversion`

Similarly for blending (i.e. all blending except opaque blending). By using an explicit sRGB texture format, the hardware will perform the linear-to-sRGB conversion when appropriate.

`blending -> hardware linear-to-sRGB conversion != user defined linear-to-sRGB conversion -> blending`

Alternatively, a render target with a half-precision floating-point format can and should be used, if linear color values need to be stored instead. This, however, is not the responsibility of ImGui. ImGui should output linear colors, and the user of ImGui should provide an appropriate render target (i.e. `R8G8B8A8_SRGB` or `R16G16B16A16`). Most games let the user use a custom gamma encoding to adjust brightness instead of using the default sRGB encoding. So in these uses cases, ImGui will output to a render target with a half-precision floating-point format in a first pass. The final pass will apply the custom gamma encoding and output **without blending** to a R8G8B8A8 render target.

# Use cases

## ImGui
The changes required to [ImGui](https://github.com/ocornut/imgui):
- ImGui uses one font texture by default. This texture should be formatted correctly: sRGB if appropriate. Though, it just contains completely black and white color values which should map to the same values independent of the used color space.
- If ImGui performs (sRGB) color additions and/or multiplications on the CPU, the involved colors should be transformed first to linear color space, then the additions and/or multiplications are applied, finally the resulting colors are transformed back to sRGB color space.
- The vertex shader should transform the vertex color attribute from sRGB to linear color space.

Application to the D3D11 demo (similar for other graphics APIs):

[**main.cpp**](https://github.com/ocornut/imgui/blob/master/examples/example_win32_directx11/main.cpp)
```c++
// Perceptually a better choice than the current DXGI_FORMAT_R8G8B8A8_UNORM:
sd.BufferDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM_SRGB;
```

[**imgui_impl_dx11.cpp**](https://github.com/ocornut/imgui/blob/master/examples/imgui_impl_dx11.cpp)

```c++
static const char* vertexShader =
     "cbuffer vertexBuffer : register(b0) \
     {\
     float4x4 ProjectionMatrix; \
     };\
     struct VS_INPUT\
     {\
     float2 pos : POSITION;\
     float4 col : COLOR0;\
     float2 uv  : TEXCOORD0;\
     };\
     \
     struct PS_INPUT\
     {\
     float4 pos : SV_POSITION;\
     float4 col : COLOR0;\
     float2 uv  : TEXCOORD0;\
     };\
     \
     PS_INPUT main(VS_INPUT input)\
     {\
     PS_INPUT output;\
     output.pos = mul( ProjectionMatrix, float4(input.pos.xy, 0.f, 1.f));\
     output.col = SRGBtoLinear(input.col);\
     output.uv  = input.uv;\
     return output;\
     }";
```

## MAGE
[MAGE v0](https://github.com/matt77hias/MAGE-v0) uses the following conventions:
* All separate colors from material files are expressed in **sRGB** color space;
* All separate colors from color pickers (i.e. ImGui) are expressed in **sRGB** color space;
* All separate textures (including fonts) are expressed in **linear or sRGB** color space and explicitly encoded as such;
* All internally stored separate colors are expressed in **linear** color space (for both C++ and HLSL). Exceptions: 
  * All internally stored separate colors of ImGui are expressed in **sRGB** color space; 
  * All internally stored separate colors of the voxelization are expressed in **LogLuv** color space;
* All color calculations (including filtering and blending) are performed in **linear** color space (for both C++ and HLSL);
* Final outputted colors are expressed in a custom **gamma** encoded color space (i.e. brightness adjustment).
