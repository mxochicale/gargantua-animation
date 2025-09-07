import canvasManager from 'https://cdn.jsdelivr.net/gh/gh-o-st/utilities@stable/canvasmanager.js';
import { ShaderBuilder, RenderPipeline } from 'https://cdn.jsdelivr.net/gh/gh-o-st/utilities@stable/shaderbuilder.js';
import FPSCounter from 'https://cdn.jsdelivr.net/gh/gh-o-st/utilities@stable/fps.js';

const manager = canvasManager().attach('simulation');
const canvas = manager.el;
const gl = manager.context('webgl2');

manager.resize('full', 'full').listen('resize');

const fps = new FPSCounter();

const discColor = { r: 0.22, g: 0.32, b: 1.0 };

const vsource = `#version 300 es
precision highp float;

in vec2 a_position;
out vec2 v_texCoord;

void main() {
    v_texCoord = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const fsource = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform sampler2D u_texture0;
uniform vec3 u_discColor;

#define AA 2
#define _Speed 0.15
#define _Steps  12.0  
#define _Size 0.23

float hash(float x){ return fract(sin(x)*152754.742);}
float hash(vec2 x){	return hash(x.x + hash(x.y));}

float value(vec2 p, float f)
{
    vec2 floored = floor(p*f);
    float bl = hash(floored);
    float br = hash(floored + vec2(1.,0.));
    float tl = hash(floored + vec2(0.,1.));
    float tr = hash(floored + vec2(1.,1.));

    vec2 fr = fract(p*f);    
    fr = (3. - 2.*fr)*fr*fr;	
    float b = mix(bl, br, fr.x);	
    float t = mix(tl, tr, fr.x);
    return  mix(b,t, fr.y);
}

vec4 background(vec3 ray)
{

    vec2 uv = ray.xy * 0.5 + 0.5; 
    float r = length(ray.xy);

    float lensing = exp(-2.5 * r * r); 
    uv = mix(uv, vec2(0.5), lensing); 

    uv = clamp(uv, 0.0, 1.0);
    vec4 nebulae = texture(u_texture0, uv);

    float vignette = smoothstep(0.8, 0.45, length(uv - vec2(0.5)));
    nebulae.rgb *= vignette;

    nebulae.rgb = pow(nebulae.rgb, vec3(1.2)); 
    nebulae.rgb *= 0.8;

    float brightness = value(uv*3., 87.);
    brightness = pow(brightness, 256.);
    brightness = clamp(brightness * 50., 0., 1.); 
    vec3 stars = brightness * mix(vec3(1., .6, .2), vec3(.2, .6, 1), value(uv*2., 20.));

    return vec4(nebulae.rgb + stars, 1.0);
}

vec4 raymarchDisk(vec3 ray, vec3 zeroPos)
{    
    vec3 position = zeroPos;      
    float lengthPos = length(position.xz);
    float dist = min(1., lengthPos*(1./_Size) *0.5) * _Size * 0.4 *(1./_Steps) /( abs(ray.y) );

    position += dist*_Steps*ray*0.4;     

    vec2 deltaPos;
    deltaPos.x = -zeroPos.z*0.01 + zeroPos.x;
    deltaPos.y = zeroPos.x*0.01 + zeroPos.z;
    deltaPos = normalize(deltaPos - zeroPos.xz);

    float parallel = dot(ray.xz, deltaPos);
    parallel /= sqrt(lengthPos);
    parallel *= 0.4;
    float redShift = parallel +0.35;
    redShift *= redShift;

    redShift = clamp(redShift, 0., 1.);

    float disMix = clamp((lengthPos - _Size * 2.)*(1./_Size)*0.24, 0., 1.);

    vec3 baseCol = u_discColor;
    vec3 altCol = vec3(0.5,0.17,0.38)*0.25;
    vec3 insideCol = mix(baseCol, altCol, disMix);
    insideCol *= mix(vec3(0.4, 0.2, 0.1), vec3(1.6, 2.4, 4.0), redShift);
    insideCol *= 1.28;
    redShift += 0.08;
    redShift *= redShift;

    vec4 o = vec4(0.);

    for(float i = 0. ; i < _Steps; i++)
    {                      
        position -= dist * ray ;  

        float intensity =clamp( 1. - abs((i - 0.8) * (1./_Steps) * 2.), 0., 1.); 
        float lengthPos = length(position.xz);
        float distMult = 1.;

        distMult *=  clamp((lengthPos -  _Size * 0.75) * (1./_Size) * 1.5, 0., 1.);        
        distMult *= clamp(( _Size * 10. -lengthPos) * (1./_Size) * 0.20, 0., 1.);
        distMult *= distMult;

        float u = lengthPos + u_time* _Size*0.3 + intensity * _Size * 0.2;

        vec2 xy ;
        float rot = mod(u_time*_Speed, 8192.);
        xy.x = -position.z*sin(rot) + position.x*cos(rot);
        xy.y = position.x*sin(rot) + position.z*cos(rot);

        float x = abs( xy.x/(xy.y));         
        float angle = 0.02*atan(x);

        const float f = 70.;
        float noise = value( vec2( angle, u * (1./_Size) * 0.05), f);
        noise = noise*0.66 + 0.33*value( vec2( angle, u * (1./_Size) * 0.05), f*2.);     

        float extraWidth =  noise * 1. * (1. -  clamp(i * (1./_Steps)*2. - 1., 0., 1.));

        float alpha = clamp(noise*(intensity + extraWidth)*( (1./_Size) * 10.  + 0.01 ) *  dist * distMult , 0., 1.);

        vec3 col = 2.*mix(vec3(0.3,0.2,0.15)*insideCol, insideCol, min(1.,intensity*2.));
        o = clamp(vec4(col*alpha + o.rgb*(1.-alpha), o.a*(1.-alpha) + alpha), vec4(0.), vec4(1.));

        lengthPos *= (1./_Size);

        o.rgb+= redShift*(intensity*1. + 0.5)* (1./_Steps) * 100.*distMult/(lengthPos*lengthPos);
    }  

    o.rgb = clamp(o.rgb - 0.005, 0., 1.);
    return o ;
}

void Rotate( inout vec3 vector, vec2 angle )
{
    vector.yz = cos(angle.y)*vector.yz
                +sin(angle.y)*vec2(-1,1)*vector.zy;
    vector.xz = cos(angle.x)*vector.xz
                +sin(angle.x)*vec2(-1,1)*vector.zx;
}

void main()
{
    vec2 fragCoord = v_texCoord * u_resolution;
    fragColor = vec4(0.);;

    vec2 fragCoordRot;
    fragCoordRot.x = fragCoord.x*0.985 + fragCoord.y * 0.174;
    fragCoordRot.y = fragCoord.y*0.985 - fragCoord.x * 0.174;
    fragCoordRot += vec2(-0.06, 0.12) * u_resolution.xy;

    vec3 ray = normalize( vec3((fragCoordRot-u_resolution.xy*.5)/u_resolution.x, 1 )); 
    vec3 pos = vec3(0.,0.05,-(20.*u_mouse.xy/u_resolution.y-10.)*(20.*u_mouse.xy/u_resolution.y-10.)*.05); 
    vec2 angle = vec2(u_time*0.1,.2);      
    angle.y = (2.*u_mouse.y/u_resolution.y)*3.14 + 0.1 + 3.14;
    float dist = length(pos);
    Rotate(pos,angle);
    angle.xy -= min(.3/dist , 3.14) * vec2(1, 0.5);
    Rotate(ray,angle);

    vec4 col = vec4(0.); 
    vec4 glow = vec4(0.); 
    vec4 outCol =vec4(100.);

    for(int disks = 0; disks< 15; disks++)
    {

        for (int h = 0; h < 6; h++) 
        {
            float dotpos = dot(pos,pos);
            float invDist = inversesqrt(dotpos);
            float centDist = dotpos * invDist;
            float stepDist = 0.92 * abs(pos.y /(ray.y));
            float farLimit = centDist * 0.5;
            float closeLimit = centDist*0.1 + 0.05*centDist*centDist*(1./_Size);
            stepDist = min(stepDist, min(farLimit, closeLimit));

            float invDistSqr = invDist * invDist;
            float bendForce = stepDist * invDistSqr * _Size * 0.625;
            ray =  normalize(ray - (bendForce * invDist )*pos);
            pos += stepDist * ray; 

        }

        float dist2 = length(pos);

        if(dist2 < _Size * 0.1)
        {
            outCol =  vec4( col.rgb * col.a + glow.rgb *(1.-col.a ) ,1.) ;
            break;
        }

        else if(dist2 > _Size * 1000.)
        {                   
            vec4 bg = background (ray);
            outCol = vec4(col.rgb*col.a + bg.rgb*(1.-col.a)  + glow.rgb *(1.-col.a    ), 1.);       
            break;
        }

        else if (abs(pos.y) <= _Size * 0.002 )
        {                             
            vec4 diskCol = raymarchDisk(ray, pos);
            pos.y = 0.;
            pos += abs(_Size * 0.001 /ray.y) * ray;  
            col = vec4(diskCol.rgb*(1.-col.a) + col.rgb, col.a + diskCol.a*(1.-col.a));
        }	
    }

    if(outCol.r == 100.)
        outCol = vec4(col.rgb + glow.rgb *(col.a +  glow.a) , 1.);

    col = outCol;
    col.rgb =  pow( col.rgb, vec3(0.6) );

    fragColor = col; 
}`;

const shader = new ShaderBuilder(gl, vsource, fsource);

shader.build();

const quadVertices = new Float32Array([
    -1, -1,
    1, -1,
    -1,  1,
    1,  1
]);

shader.createVAO('quad');
shader.bindVAO('quad');
shader.createVBO('quadVertices', quadVertices);
gl.bindBuffer(gl.ARRAY_BUFFER, shader._vbos.get('quadVertices'));
shader.setAttribute('a_position', 2, gl.FLOAT);

const loadingIndicator = document.createElement('div');
loadingIndicator.id = 'loading';
loadingIndicator.style.position = 'absolute';
loadingIndicator.style.top = '50%';
loadingIndicator.style.left = '50%';
loadingIndicator.style.transform = 'translate(-50%, -50%)';
loadingIndicator.style.color = 'white';
loadingIndicator.style.fontSize = '24px';
loadingIndicator.style.fontFamily = 'Arial, sans-serif';
loadingIndicator.textContent = 'Loading Nebula Texture...';
document.body.appendChild(loadingIndicator);

let nebulaTexture = null;
const loadNebulaTexture = (imageUrl) => {
    return new Promise((resolve, reject) => {
        const texture = gl.createTexture();
        const image = new Image();
        image.crossOrigin = "Anonymous";
        image.onload = () => {
            function nextPowerOfTwo(x) {
                return Math.pow(2, Math.ceil(Math.log2(x)));
            }
            const potWidth = nextPowerOfTwo(image.width);
            const potHeight = nextPowerOfTwo(image.height);
            const canvasPOT = document.createElement('canvas');
            canvasPOT.width = potWidth;
            canvasPOT.height = potHeight;
            const ctx = canvasPOT.getContext('2d');
            ctx.drawImage(image, 0, 0, potWidth, potHeight);

            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvasPOT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.generateMipmap(gl.TEXTURE_2D);
            nebulaTexture = texture;

            if (loadingIndicator.parentNode) {
                loadingIndicator.parentNode.removeChild(loadingIndicator);
            }

            resolve(texture);
        };
        image.onerror = (err) => {
            console.error('Failed to load nebula texture:', err);
            if (loadingIndicator.parentNode) {
                loadingIndicator.parentNode.removeChild(loadingIndicator);
            }
            reject(err);
        };
        image.src = imageUrl;
    });
};

const nebulaImageUrl = 'https://images.unsplash.com/photo-1610296669228-602fa827fc1f?w=1920';
loadNebulaTexture(nebulaImageUrl).then(() => {
    console.log('Nebula texture loaded successfully');
}).catch((err) => {
    console.error('Error loading nebula texture:', err);
    const fallbackTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, fallbackTexture);
    const fallbackData = new Uint8Array([100, 50, 150, 255]); // Purple fallback
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, fallbackData);
    nebulaTexture = fallbackTexture;

    if (loadingIndicator.parentNode) {
        loadingIndicator.parentNode.removeChild(loadingIndicator);
    }
});

let startTime = Date.now();

const render = () => {
    const currentTime = (Date.now() - startTime) / 1000;

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    shader.use();
    shader.bindVAO('quad');

    shader.setUniform1f('u_time', currentTime);
    shader.setUniform2f('u_resolution', canvas.width, canvas.height);

    if (nebulaTexture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, nebulaTexture);
        shader.setUniform1i('u_texture0', 0);
    }

    shader.setUniform3f('u_discColor', discColor.r, discColor.g, discColor.b);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(render);
};

window.addEventListener('resize', () => {
    manager.resize('full', 'full');
});

render();
