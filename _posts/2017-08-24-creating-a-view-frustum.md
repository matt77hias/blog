---
layout: post
math: true
title:  "Creating a View Frustum in Local/World/Camera Space using SIMD"
date:   2017-08-24
description: ""
---

# GPU - View Frustum Culling
The fixed-function (i.e. non-programmable, but configurable) [Rasterizer Stage](https://docs.microsoft.com/en-us/windows/desktop/direct3d11/d3d10-graphics-programming-guide-rasterizer-stage) (`RS`) of the graphics pipeline receives individual primitives as input and generates fragments as output. In order to generate these fragments, multiple functional operations are performed:
1. Primitive Culling
2. Primitive Clipping
3. Homogeneous Divide
4. Viewport Transformation
5. Fragment Generation
6. Scissor Test
7. Attribute Interpolation

The first operation, Primitive Culling, implies both back face culling (if enabled) and view frustum culling. From here on, we will only focus on the latter type of culling. 

If view frustum culling takes place after the homogeneous divide, the associated culling space corresponds to the `Normalized Device Coordinate` (NDC) space (denoted with a superscript $$\mathrm{ndc}$$). In this space, the following six equations need to be satisfied:

$$\begin{align}
-1 &\le p_x^{\mathrm{ndc}} \le 1\\
-1 &\le p_y^{\mathrm{ndc}} \le 1\\
 0 &\le p_z^{\mathrm{ndc}} \le 1
\end{align}$$

A point primitive is culled if its vertex does not satisfy these equations and thus is positioned outside the view frustum. A triangle primitive is culled if all three of its vertices do not satisfy these equations.

By performing culling before the homogeneous divide, an expensive divide operation can be omitted for every culled primitive. The associated culling space corresponds to `projection space` (denoted with a superscript $$\mathrm{proj}$$). In this space, the following six equations need to be satisfied:

$$\begin{align}
-p_w^{\mathrm{proj}} &\le p_x^{\mathrm{proj}} \le p_w^{\mathrm{proj}}\\
-p_w^{\mathrm{proj}} &\le p_y^{\mathrm{proj}} \le p_w^{\mathrm{proj}}\\
 0                   &\le p_z^{\mathrm{proj}} \le p_w^{\mathrm{proj}}
\end{align}$$

We will use the same equations to perform culling outside of the graphics pipeline, on the CPU. This way we can decrease the number of draw calls and decrease the number of wasted (*the primitives will be culled anyway*) VS, DS, TS, HS and GS invocations on the GPU. Instead of culling individual primitives themselves, culling will be performed on a coarser (e.g., (sub)model) level. Furthermore, we can even cull entities which only have an associated volume, but no associated geometry (e.g., lights).

# CPU - View Frustum Culling
Typically, a `Bounding Volume` (BV) is associated with and expressed in the local space of each submodel. Since a submodel is completely contained in its BV, culling the BV is equivalent to culling the submodel: if the BV is completely positioned outside a view frustum, the contained submodel is also completely positioned outside that view frustum. All kinds of BVs can be used for this purpose as long as they fit the submodel tightly, and are cheap to cull against a view frustum. Note that the tightest BV of a submodel is the submodel itself, but this BV is in general very expensive to cull directly. Frequently used BVs include `Bounding Spheres` (BSs),  `Axis-Aligned Bounding Boxes` (AABBs) and `Oriented Bounding Boxes` (OBBs).

Now that we have BVs (the entities we are going to cull against the view frustum), all that remains is creating a view frustum in the local coordinate space of the BV and thus the local coordinate space of the submodel. A view frustum consists of six bounding planes. A plane $$\left(\hat{n} \vert d\right)$$ is mathematically characterized by a normal vector $$\hat{n}$$ (rotation) and a signed distance $$d$$ (translation) from the origin in the direction of its normal $$\hat{n}$$. 

A point $$p = \left(p_x,p_y,p_z\right)$$ satisfies the following relations:
* If $$\hat{n} \cdot p + d  =  0$$, then $$p$$ lies on the plane $$\left(\hat{n} \vert d\right)$$;
* If $$\hat{n} \cdot p + d \gt 0$$, then $$p$$ lies above the plane $$\left(\hat{n} \vert d\right)$$;
* If $$\hat{n} \cdot p + d \lt 0$$, then $$p$$ lies below the plane $$\left(\hat{n} \vert d\right)$$.

Alternatively, a homogeneous point $$p = \left(p_x,p_y,p_z,1\right)$$ satisfies the following relations:
* If $$\left(\hat{n}, d\right) \cdot p  =  0$$, then $$p$$ lies on the plane $$\left(\hat{n} \vert d\right)$$;
* If $$\left(\hat{n}, d\right) \cdot p \gt 0$$, then $$p$$ lies above the plane $$\left(\hat{n} \vert d\right)$$;
* If $$\left(\hat{n}, d\right) \cdot p \lt 0$$, then $$p$$ lies below the plane $$\left(\hat{n} \vert d\right)$$.

If we use six inward facing planes for our view frustum, all points $$p$$ satisfying $$\left(\hat{n}, d\right) \cdot p \lt 0$$ for at least one plane of the view frustum will be culled.

But how do you obtain the six planes? Let's look at the transformation from local\|world\|camera space (denoted with a superscript $$s$$) to projection space:

$$\begin{align}
p^{\mathrm{proj}}
&= \left( p_x^{\mathrm{proj}}, p_y^{\mathrm{proj}}, p_z^{\mathrm{proj}}, p_w^{\mathrm{proj}} \right) \\
&= \left( p_x^s, p_y^s, p_z^s, 1 \right) \mathrm{T}^{s \rightarrow \mathrm{proj}} \\
&= p^s \mathrm{T}^{s \rightarrow \mathrm{proj}} \\
&= \begin{bmatrix}p^{s} \cdot \mathrm{T}_{.,1}^{s \rightarrow \mathrm{proj}} \\p_{s} \cdot \mathrm{T}_{.,2}^{s \rightarrow \mathrm{proj}} \\p_{s} \cdot \mathrm{T}_{.,3}^{s \rightarrow \mathrm{proj}} \\p_{s} \cdot \mathrm{T}_{.,4}^{s \rightarrow \mathrm{proj}} \end{bmatrix}.
\end{align}$$

Here, we see that the coordinates of $$p^{proj}$$ (projection space coordinates) can be expressed as the dot product of $$p^{s}$$ and one of the columns of the transform matrix $$\mathrm{T}^{s \rightarrow \mathrm{proj}}$$. Combining this with the equations used for culling in projection space (see above), results in a substitution of the projection space coordinates, which directly leads to the six planes of the view frustum (one for each equation).

# Code
If we use an `SIMD` library such as `DirectXMath`, matrices are represented in row-major order. Each row of a matrix will be put in an SIMD register. To perform additions and subtractions between columns, one could retrieve the individual elements and perform the arithmetic operations without using SIMD. Alternatively, one could take the transpose of the matrix (*columns become rows and vice versa*) to perform the arithmetic operations using SIMD:

```c++
/**
 Constructs a bounding frustum from the given transform.

 If the given transform represents the view-to-projection transformation matrix, 
 the planes of the bounding frustum are represented by view space coordinates.
 If the given transform represents the world-(to-view)-to-projection transformation matrix, 
 the planes of the bounding frustum are represented by world space coordinates.
 If the given transform represents the object-(to-world-to-view)-to-projection transformation 
 matrix, the planes of the bounding frustum are represented by object space coordinates.
 
 @param[in]		transform
			The transform.
 */
BoundingFrustum::BoundingFrustum(CXMMATRIX transform) noexcept
{
	const auto C = XMMatrixTranspose(transform);

	// Extract the view frustum planes from the given transform.
	// All view frustum planes are inward facing: 0 <= n . p + d

	// p' = (x',y',z',w') = (x,y,z,1) T = p T

	//   -w' <= x'
	// <=> 0 <= w' + x'
	// <=> 0 <= p . c3 + p . c0
	// <=> 0 <= p . (c3 + c0)
	m_left_plane = C.r[3] + C.r[0];

	//    x' <= w'
	// <=> 0 <= w' - x'
	// <=> 0 <= p . c3 - p . c0
	// <=> 0 <= p . (c3 - c0)
	m_right_plane = C.r[3] - C.r[0];

	//   -w' <= y'
	// <=> 0 <= w' + y'
	// <=> 0 <= p . c3 + p . c1
	// <=> 0 <= p . (c3 + c1)
	m_bottom_plane = C.r[3] + C.r[1];

	//    y' <= w'
	// <=> 0 <= w' - y'
	// <=> 0 <= p . c3 - p . c1
	// <=> 0 <= p . (c3 - c1)
	m_top_plane = C.r[3] - C.r[1];

	//     0 <= z'
	// <=> 0 <= p . c2
	m_near_plane = C.r[2];

	//    z' <= w'
	// <=> 0 <= w' - z'
	// <=> 0 <= p . c3 - p . c2
	// <=> 0 <= p . (c3 - c2)
	m_far_plane = C.r[3] - C.r[2];

	// Normalize the view frustum planes.
	for (size_t i = 0; i < std::size(m_planes); ++i)
	{
		m_planes[i] = XMPlaneNormalize(m_planes[i]);
	}
}
```

# References
The construction of view frustums in [MAGE v0](https://github.com/matt77hias/MAGE-v0/blob/master/MAGE/Code/Engine/Math/geometry/bounding_volume.cpp#L242).
