import React, { useEffect, useState } from "react";
import ReactDom from "react-dom";
import { Grid, Paper, Typography, FormGroup, Slider, Button } from "@material-ui/core";
import PublishIcon from "@material-ui/icons/Publish";
import SaveIcon from "@material-ui/icons/Save";

import CssBaseline from '@material-ui/core/CssBaseline';

import frag from "./shader.frag";
import vert from "./shader.vert";

import defaultImage from "./checkers.png";

// main renderer
class Renderer {
    constructor() {
        this.gl = null;
        this.config = null;
        this.tex = null; // main texture
        this.texCpy = null; // copy pass texture
        this.init = this.init.bind(this);
        this.setConfig = this.setConfig.bind(this);
        this.setImage = this.setImage.bind(this);
        this.renderFrame = this.renderFrame.bind(this);
        this.requestRenderFrame = this.requestRenderFrame.bind(this);
    }

    init(gl) {
        console.log("init running... creating shaders and buffers...");
        this.gl = gl;

        // create fragment shader
        const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragShader, frag);
        gl.compileShader(fragShader);
        if(!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(fragShader));
        }
        
        // create vertex shader
        const vertShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertShader, vert);
        gl.compileShader(vertShader);
        if(!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(vertShader));
        }
        
        // create program
        const prog = gl.createProgram();
        gl.attachShader(prog, fragShader);
        gl.attachShader(prog, vertShader);
        gl.linkProgram(prog);
        gl.useProgram(prog);

        // allocate buffer for quad (triangle strip based)
        var posBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0, 1,0, 0,1, 1,1, 1,0]), gl.STATIC_DRAW);

        // locate and bind attribute content
        let posId = gl.getAttribLocation(prog, "pos");
        gl.enableVertexAttribArray(posId);
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.vertexAttribPointer(posId, 2, gl.FLOAT, false, 0, 0);
    }

    // called by react component to pass it's state to the renderer without refreshing actual components
    setConfig(config) {
        this.config = config;
    }

    // render single webgl frame
    renderFrame() {
        const gl = this.gl;

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.clearColor(0.0, 0.0, 0.5, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        if(!this.config)
            return;

        if(this.tex) {
            gl.bindTexture(gl.TEXTURE_2D, this.tex);
        }

        // get uniform locations and apply config values
        const prog = gl.getParameter(gl.CURRENT_PROGRAM);

        const powerLoc = gl.getUniformLocation(prog, "sigma");
        gl.uniform1f(powerLoc, this.config.sigma);

        const stepLoc = gl.getUniformLocation(prog, "step");
        gl.uniform1f(stepLoc, this.config.step);

        const sizeLoc = gl.getUniformLocation(prog, "size");
        gl.uniform2f(sizeLoc, gl.canvas.width, gl.canvas.height);

        const dirLoc = gl.getUniformLocation(prog, "dir");
        gl.uniform2f(dirLoc, 1.0, 0.0); // horizontal blur pass goes first

        // draw fullscreen quad
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 5);

        // copy framebuffer into texture to repeat blurring 
        for(let i = 0; i<this.config.repeat; i++) {
            if(this.texCpy) {
                gl.bindTexture(gl.TEXTURE_2D, this.texCpy);
                gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGB, 0, 0, gl.canvas.width, gl.canvas.height, 0);
            }

            gl.uniform2fv(dirLoc, (i%2==0)?[0,1]:[1,0]); // swap blur direction
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 5);
        }

        gl.flush();
    }

    requestRenderFrame() {
        requestAnimationFrame(this.renderFrame);
    }

    // sets new image to process
    setImage(img) {
        console.log("setting image content... deleting and creating textures...");

        const gl = this.gl;

        if(this.tex) {
            gl.deleteTexture(this.tex);
            this.tex = null;
        }

        if(this.texCpy) {
            gl.deleteTexture(this.texCpy);
            this.texCpy = null;
        }

        if(!img) {
            console.log("no image, skipping texture creation");
            return;
        }

        // texture for multipass rendering
        this.texCpy = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texCpy);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.canvas.width, gl.canvas.height, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // original texture image
        this.tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // preflip image to avoid flipping coordinates in shaders
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
}

const renderer = new Renderer();

// Controls react component
function ControlsItem(props) {
    let [config, setConfig] = useState({
        sigma: 3,
        step: 1,
        repeat: 1,
        auto: false
        // ...
    });
    
    // pass changes to renderer and update
    useEffect(()=>{
        renderer.setConfig(config); // pass config
        renderer.requestRenderFrame();
    }, [config]);

    let file; // for clicking upload button
    return (<FormGroup>
        <Typography variant="h5" gutterBottom>Настройки:</Typography>
        <Typography >Сила размытия (sigma): {config.sigma}</Typography>
        <Slider min={1} max={10} value={config.sigma} step={1} onChange={(e, value)=>setConfig({...config, sigma: value})}></Slider>
        <Typography >Шаг: {config.step}</Typography>
        <Slider min={0.1} max={10} value={config.step} step={0.1} onChange={(e, value)=>setConfig({...config, step: value})}></Slider>
        <Typography >Проходы<sup>*</sup>: {config.repeat+1}</Typography>
        <Slider min={0} max={7} value={config.repeat} step={1} onChange={(e, value)=>setConfig({...config, repeat: value})}></Slider>
        <Typography variant="subtitle2" gutterBottom><sup>*</sup> Используется двухпроходный способ с переключением направления сглаживания.</Typography>
        <Button variant="outlined" color="primary" startIcon={<PublishIcon/>} onClick={()=>file.click()}>Загрузить</Button>
        <Button variant="outlined" color="secondary" startIcon={<SaveIcon/>} onClick={props.handleSave}>Сохранить</Button>
        <input ref={(el)=>file = el} type="file" accept="image/*" onChange={props.handleUpload} hidden></input>
    </FormGroup>);
}

// Main application component
function App() {
    let canvas;
    const [state, setState] = useState({width: 300, height: 300});

    // file open handler
    function handleUpload(e) {
        if(!e.target || !e.target.files || e.target.files.length < 1)
            return;
        let file = e.target.files[0];

        createImageBitmap(file).then((image)=>{
            console.log("image download and ready to be processed...");

            renderer.setImage(image);
            renderer.requestRenderFrame();

            console.log("handleUpload done and updates canvas size now!");
            setState({width: image.width, height: image.height});
        });
    }

    // file save handler
    function handleSave() {
        if(renderer && renderer.gl) {
            window.open(canvas.toDataURL());
        }
    }

    // init the renderer on component creation
    useEffect(()=>{
        console.log("init renderer, loading default image");

        const gl = canvas.getContext("webgl", {preserveDrawingBuffer: true}); // preserve to keep image
        renderer.init(gl);

        // auto-load bundled image on start
        let img = new Image();
        img.src = defaultImage;
        img.onload = (e) => handleUpload({target: { files: [ e.target ], length: 1 }});
    }, []); // once

    return (<><CssBaseline />
        <Paper style={{maxWidth: 800, margin: "16px auto", padding: 16, position: "relative"}} elevation={3}>
            <Grid container justify="center" alignContent="space-around" spacing={3}>
                <Grid item xs={5}>
                    <ControlsItem handleUpload={handleUpload} handleSave={handleSave} />
                </Grid>
                <Grid item xs>
                    <Grid container direction="column" spacing={1}>
                        <Grid item><Typography variant="h5" gutterBottom>Результат:</Typography></Grid>
                        <Grid item>
                            <canvas ref={(el)=>canvas = el} width={state.width} height={state.height} style={{display: "block", maxWidth: "100%", maxHeight: "100%", margin: "auto"}}/>
                        </Grid>
                        
                    </Grid>
                </Grid>
            </Grid>
            <a href="mailto:gvm@nm.ru" style={{position: "absolute", bottom: "1em", right: "1em"}}>by gogiii</a>
        </Paper>
    </>);
}

const root = document.getElementById("root");
ReactDom.render(<App/>, root);