Shader "TextureDraw" {
Properties {
	_Color ("Main Color", Color) = (1,1,1,1)
	_MainTex ("Background", 2D) = "white" {}
	_Drawing ("Drawing", 2D) = "white" {}
}

    SubShader {
        Pass {
            // Apply base texture
            SetTexture [_MainTex] {
            }
            // Blend in the alpha texture using the lerp operator
            SetTexture [_Drawing] {
            	ConstantColor (0,0,0, 1) 
                combine previous *  texture
            }
        }
    }
} 

