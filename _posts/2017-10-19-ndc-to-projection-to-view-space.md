---
layout: post
math: true
title:  "NDC to Projection to Camera Space"
date:   2017-10-19
description: ""
---

# Introduction
In [deferred shading](https://en.wikipedia.org/wiki/Deferred_shading), geometrical (e.g., normal, depth) and material data is stored in a GBuffer in a first pass. 
The actual lighting takes place in a second pass based on the data stored in the GBuffer.
With regard to geometrical data, we minimally need a surface position and normal, both expressed in camera or world space coordinates depending on the space used for lighting computations. 
There is no need, however, for storing an explicit surface position in the GBuffer (and thus wasting valuable memory resources and bandwidth), since this surface position can be reconstructed.
(*For the remainder, we assume that the lighting computations take place in camera space. 
If you want to use world space instead, you need to additionally transform the reconstructed surface position from camera to world space before applying your lighting computations.*)

# Perspective Camera Only Approach
A (row-major) perspective transformation matrix has the following format:

$$\begin{align} 
\mathrm{T}^{\mathrm{cam \rightarrow proj}}
&= \begin{bmatrix} 
\mathrm{T}_{00} &0 &0 &0 \\ 
0 &\mathrm{T}_{11} &0 &0 \\ 
0 &0 &\mathrm{T}_{22} &1 \\ 
0 &0 &\mathrm{T}_{32} &0 \end{bmatrix}
=\begin{bmatrix} 
1/X &0 &0 &0 \\ 
0 &1/Y &0 &0 \\ 
0 &0 &-W &1 \\ 
0 &0 &Z &0 \end{bmatrix} \! . 
\end{align}$$

This transformation matrix is used to transform (*homogeneous*) points from camera ($$p^{\mathrm{cam}}$$) to projection ($$p^{\mathrm{proj}}$$) space, after which the homogeneous divide ($$p_{w}^{\mathrm{proj}}$$) is applied to transform to NDC (Normalized Device Coordinate, $$p^{\mathrm{ndc}}$$) space. (*NDC space is technically a 3D space, but for ease of notation, I use 4D points with a $$w=1$$*). If we explicitly write down this chain of transformations, we obtain:

$$\begin{align}
p^{\mathrm{cam}} \mathrm{T}^{\mathrm{cam} \rightarrow \mathrm{proj}}  &= \left(\frac{1}{X} p_{x}^\mathrm{cam}, \frac{1}{Y} p_{y}^\mathrm{cam}, -W~p_{z}^\mathrm{cam} + Z, p_{z}^\mathrm{cam}\right) = p^{\mathrm{proj}} \\
p^{\mathrm{proj}}/p_{w}^{\mathrm{proj}} &= \left(\frac{1}{X} \frac{p_{x}^\mathrm{cam}}{p_{z}^\mathrm{cam}}, \frac{1}{Y} \frac{p_{y}^\mathrm{cam}}{p_{z}^\mathrm{cam}}, -W + \frac{Z}{p_{z}^\mathrm{cam}}, 1\right) = p^{\mathrm{ndc}}.
\end{align}$$

In a deferred renderer, we need to go the other way around while resolving the GBuffer and could use four components ($$X$$, $$Y$$, $$Z$$, $$W$$, see above) to transform a point from NDC to camera space:

$$\begin{align}
p_{z}^\mathrm{ndc} &= -W + \frac{Z}{p_{z}^\mathrm{cam}} 
&\Leftrightarrow p_{z}^\mathrm{cam} &= \frac{Z}{p_{z}^\mathrm{ndc} + W}\\
p_{x}^\mathrm{ndc} &= \frac{1}{X} \frac{p_{x}^\mathrm{cam}}{p_{z}^\mathrm{cam}} 
&\Leftrightarrow p_{x}^\mathrm{cam} &= X~p_{x}^\mathrm{ndc}~p_{z}^\mathrm{cam}\\
p_{y}^\mathrm{ndc} &= \frac{1}{Y} \frac{p_{y}^\mathrm{cam}}{p_{z}^\mathrm{cam}} 
&\Leftrightarrow p_{y}^\mathrm{cam} &= Y~p_{y}^\mathrm{ndc}~p_{z}^\mathrm{cam}.
\end{align}$$

```c++
/**
 Returns the projection values from the given projection matrix to construct the camera position 
 coordinates from the NDC position coordinates.

 @return   The projection values from the given projection matrix to construct the camera position 
           coordinates from the NDC position coordinates.
 */
[[nodiscard]]
inline const XMVECTOR XM_CALLCONV 
    GetCameraPositionConstructionValues(FXMMATRIX projection_matrix) noexcept
{

    //          [ 1/X  0   0  0 ]
    // p_camera [  0  1/Y  0  0 ] = [p_camera.x 1/X, p_camera.y 1/Y, p_camera.z (-W) + Z, p_camera.z] = p_proj
    //          [  0   0  -W  1 ]
    //          [  0   0   Z  0 ]
    //
    // p_proj / p_proj.w          = [p_camera.x/p_camera.z 1/X, p_camera.y/p_camera.z 1/Y, -W + Z/p_camera.z, 1] = p_ndc
    //
    // Construction of p_camera from p_ndc and projection values
    // 1) p_ndc.z = -W + Z/p_camera.z         <=> p_camera.z = Z / (p_ndc.z + W)
    // 2) p_ndc.x = p_camera.x/p_camera.z 1/X <=> p_camera.x = X * p_ndc.x * p_camera.z
    // 3) p_ndc.y = p_camera.y/p_camera.z 1/Y <=> p_camera.y = Y * p_ndc.y * p_camera.z

    const auto X = 1.0f / XMVectorGetX(projection_matrix.r[0]);
    const auto Y = 1.0f / XMVectorGetY(projection_matrix.r[1]);
    const auto Z =  XMVectorGetZ(projection_matrix.r[3]);
    const auto W = -XMVectorGetZ(projection_matrix.r[2]);

    return { X, Y, Z, W };
}
```

# Orthographic Camera Only Approach
An (row-major) orthographic transformation matrix has the following format:

$$\begin{align} \mathrm{T}^{\mathrm{cam \rightarrow proj}}
&= \begin{bmatrix} 
\mathrm{T}_{00} &0 &0 &0 \\ 
0 &\mathrm{T}_{11} &0 &0 \\ 
0 &0 &\mathrm{T}_{22} &0 \\ 
0 &0 &\mathrm{T}_{32} &1 \end{bmatrix}
=\begin{bmatrix} 
1/X &0 &0 &0 \\ 
0 &1/Y &0 &0 \\ 
0 &0 &1/Z &0 \\ 
0 &0 &-W &1 \end{bmatrix} \! . 
\end{align}$$

This transformation matrix is used to transform (*homogeneous*) points from camera ($$p^{\mathrm{cam}}$$) to projection ($$p^{\mathrm{proj}}$$) space, after which the homogeneous divide (no-op) is applied to transform to NDC (= projection) space. (*So basically a non-uniform scaling followed by a translation of the z component*).

If we explicitly write down this chain of transformations, we obtain:

$$\begin{align}
p^{\mathrm{cam}} \mathrm{T}^{\mathrm{cam} \rightarrow \mathrm{proj}}  &= \left(\frac{1}{X} p_{x}^\mathrm{cam}, \frac{1}{Y} p_{y}^\mathrm{cam}, \frac{1}{Z} p_{z}^\mathrm{cam} - W, 1\right) = p^{\mathrm{proj}} = p^{\mathrm{ndc}}.
\end{align}$$

Again, we could use four components ($$X$$, $$Y$$, $$Z$$, $$W$$, see above) to transform a point from NDC to camera space:

$$\begin{align}
p_{z}^\mathrm{ndc} &= \frac{1}{Z} p_{z}^\mathrm{cam} - W
&\Leftrightarrow p_{z}^\mathrm{cam} &= Z~\left(p_{z}^\mathrm{ndc} + W\right) \\
p_{x}^\mathrm{ndc} &= \frac{1}{X} p_{x}^\mathrm{cam} 
&\Leftrightarrow p_{x}^\mathrm{cam} &= X~p_{x}^\mathrm{ndc} \\
p_{y}^\mathrm{ndc} &= \frac{1}{Y} p_{y}^\mathrm{cam} 
&\Leftrightarrow p_{y}^\mathrm{cam} &= Y~p_{y}^\mathrm{ndc}.
\end{align}$$

```c++
/**
 Returns the projection values from the given projection matrix to construct the camera position 
 coordinates from the NDC position coordinates.

 @return   The projection values from the given projection matrix to construct the camera position 
           coordinates from the NDC position coordinates.
 */
[[nodiscard]]
inline const XMVECTOR XM_CALLCONV 
    GetCameraPositionConstructionValues(FXMMATRIX projection_matrix) noexcept
{

    //          [ 1/X  0   0  0 ]
    // p_camera [  0  1/Y  0  0 ] = [p_camera.x 1/X, p_camera.y 1/Y, p_camera.z 1/Z -W, 1] = p_proj = p_ndc
    //          [  0   0  1/Z 0 ]
    //          [  0   0  -W  1 ]
    //
    // Construction of p_camera from p_ndc and projection values
    // 1) p_ndc.z = p_camera.z/Z -W <=> p_camera.z = Z * (p_ndc.z + W)
    // 2) p_ndc.x = p_camera.x/X    <=> p_camera.x = X * p_ndc.x
    // 3) p_ndc.y = p_camera.y/Y    <=> p_camera.y = Y * p_ndc.y

    const auto X = 1.0f / XMVectorGetX(projection_matrix.r[0]);
    const auto Y = 1.0f / XMVectorGetY(projection_matrix.r[1]);
    const auto Z = 1.0f / XMVectorGetZ(projection_matrix.r[2]);
    const auto W = -XMVectorGetZ(projection_matrix.r[3]);

    return { X, Y, Z, W };
}
```

# Summary
So far we have seen how to reconstruct the surface position expressed in camera space, for a perspective and orthographic camera. Both reconstructions require only a `float4` coefficient vector in HLSL but are unfortunately quite different. If our deferred renderer is going to support one camera type only, we could use the appropriate reconstruction. If our deferred renderer needs to support both or even more camera types, we need to specialize our shaders statically (i.e. pre-processor directives) or dynamically (i.e. dynamic branching based on some constant buffer flag) based on the camera type. Alternatively, we can pass the inverse of our camera-to-projection matrices (i.e. projection-to-camera matrices) to reconstruct the camera space coordinates from the NDC space coordinates. We set the $$w$$ coordinate of the NDC position to $$1$$ to obtain the projection space coordinates. Next, we apply the projection-to-camera transformation, **followed by a homogeneous divide** to obtain the surface position expressed in camera space.

# Generalized Approach

The camera-to-projection and projection-to-camera matrices for a perspective camera are defined as: 

$$\begin{align} 
\mathrm{T}^{\mathrm{cam \rightarrow proj}} &= \begin{bmatrix} 
\mathrm{T}_{00} &0 &0 &0 \\ 
0 &\mathrm{T}_{11} &0 &0 \\ 
0 &0 &\mathrm{T}_{22} &1 \\ 
0 &0 &\mathrm{T}_{32} &0 \end{bmatrix} \! , \\
\mathrm{T}^{\mathrm{proj \rightarrow cam}} &=\begin{bmatrix} 
1/\mathrm{T}_{00} &0 &0 &0 \\ 
0 &1/\mathrm{T}_{11} &0 &0 \\ 
0 &0 &0 &1/\mathrm{T}_{32} \\ 
0 &0 &1 &-\mathrm{T}_{22}/\mathrm{T}_{32}\end{bmatrix} \! . 
\end{align}$$

```c++
/**
 Returns the projection-to-camera matrix of this perspective camera.

 @return   The projection-to-camera matrix of this perspective camera.
 */
[[nodiscard]]
virtual const XMMATRIX XM_CALLCONV 
    GetProjectionToCameraMatrix() const noexcept override
{
    
    const auto camera_to_projection = GetCameraToProjectionMatrix();
	
    const auto m00 = 1.0f / XMVectorGetX(camera_to_projection.r[0]);
    const auto m11 = 1.0f / XMVectorGetY(camera_to_projection.r[1]);
    const auto m23 = 1.0f / XMVectorGetZ(camera_to_projection.r[3]);
    const auto m33 = -XMVectorGetZ(camera_to_projection.r[2]) * m23;

    return
	{
        m00, 0.0f, 0.0f, 0.0f,
        0.0f,  m11, 0.0f, 0.0f,
        0.0f, 0.0f, 0.0f,  m23,
        0.0f, 0.0f, 1.0f,  m33
    };
}
```

The camera-to-projection and projection-to-camera matrices for an orthographic camera are defined as: 

$$\begin{align} 
\mathrm{T}^{\mathrm{cam \rightarrow proj}} &= \begin{bmatrix} 
\mathrm{T}_{00} &0 &0 &0 \\ 
0 &\mathrm{T}_{11} &0 &0 \\ 
0 &0 &\mathrm{T}_{22} &0 \\ 
0 &0 &\mathrm{T}_{32} &1 \end{bmatrix} \! , \\
\mathrm{T}^{\mathrm{proj \rightarrow cam}} &=\begin{bmatrix} 
1/\mathrm{T}_{00} &0 &0 &0 \\ 
0 &1/\mathrm{T}_{11} &0 &0 \\ 
0 &0 &1/\mathrm{T}_{22} &0 \\ 
0 &0 &-\mathrm{T}_{32}/\mathrm{T}_{22} &1\end{bmatrix} \! . 
\end{align}$$

```c++
/**
 Returns the projection-to-camera matrix of this orthographic camera.

 @return   The projection-to-camera matrix of this orthographic camera.
 */
[[nodiscard]]
virtual const XMMATRIX XM_CALLCONV 
    GetProjectionToCameraMatrix() const noexcept override
{
	
    const auto camera_to_projection = GetCameraToProjectionMatrix();
	
    const auto m00 = 1.0f / XMVectorGetX(camera_to_projection.r[0]);
    const auto m11 = 1.0f / XMVectorGetY(camera_to_projection.r[1]);
    const auto m22 = 1.0f / XMVectorGetZ(camera_to_projection.r[2]);
    const auto m32 = -XMVectorGetZ(camera_to_projection.r[3]) * m22;

    return
	{
         m00, 0.0f, 0.0f, 0.0f,
        0.0f,  m11, 0.0f, 0.0f,
        0.0f, 0.0f,  m22, 0.0f,
        0.0f, 0.0f,  m32, 1.0f
    };
}
```
