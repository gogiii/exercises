precision highp float;

varying vec2 uv;        // uv coordinates
uniform sampler2D tex;  // source texture

uniform float step;     // pixel step for lookup
uniform float sigma;    // blur power
uniform vec2 size;      // viewport dimensions
uniform vec2 dir;       // blur direction

#define PI 3.1415926535897932384626433832795

float gauss1d(float x, float sigma) {
    return exp(-0.5*x*x/(sigma*sigma));
}

float gauss1dn(float sigma) {
    return sqrt(2.0*PI)*sigma;
}

void main() {
    float norm = gauss1dn(sigma);
    vec4 result = texture2D(tex, uv);
    for(float i = 1.0; i<=32.0; i++) {    // maxsteps must be (sliders' range)*3 otherwise image will be darker when loop stops earlier than the maxium of value to divide
        if(i > 1.0 + ceil(sigma*3.0)) // variable for-loop emulation
            break;

        vec2 v = i*step*dir/size;
        float coef = gauss1d(i, sigma);

        result += coef*texture2D(tex, uv + v);
        result += coef*texture2D(tex, uv - v);
    }
    result /= norm;
    gl_FragColor = vec4(result.xyz, 1.0);
}

// https://en.wikipedia.org/wiki/Gaussian_blur
// http://www.frontendvision.net/2018/wp-content/uploads/2018/11/GaussianKernelMMA11.pdf
// https://stackoverflow.com/a/61355383/6731545
// http://www.sunsetlakesoftware.com/2013/10/21/optimizing-gaussian-blurs-mobile-gpu
// https://developer.nvidia.com/gpugems/gpugems3/part-vi-gpu-computing/chapter-40-incremental-computation-gaussian
// https://www.khronos.org/files/webgl/webgl-reference-card-1_0.pdf