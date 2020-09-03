precision lowp float;

attribute vec2 pos;
varying vec2 uv;

void main() {
    uv = pos;
    gl_Position = vec4(2.0*(pos - 0.5), 0.0, 1.0);
}