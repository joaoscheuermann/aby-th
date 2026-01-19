import * as PIXI from 'pixi.js';

// Vertex shader removed to use Pixi default

const fragment = `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec2 uOffset;
uniform vec4 uColor;
uniform float uAlpha;
uniform vec4 uInputSize; // (width, height, 1/width, 1/height)

void main(void) {
    vec2 offsetUV = uOffset * uInputSize.zw;
    vec4 shadowColor = texture(uTexture, vTextureCoord - offsetUV);
    
    // Calculate shadow logic: 
    // If the sample at offset has alpha, we render shadow color
    float shadowAlpha = shadowColor.a * uAlpha;
    
    vec4 original = texture(uTexture, vTextureCoord);
    
    // Composite: Original ON TOP of Shadow
    // Premultiplied alpha handling usually done by Pixi, but here we construct explicitly
    
    vec3 mixedRgb = original.rgb * original.a + uColor.rgb * shadowAlpha * (1.0 - original.a);
    float mixedAlpha = original.a + shadowAlpha * (1.0 - original.a);
    
    finalColor = vec4(mixedRgb, mixedAlpha);
}
`;

const vertex = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 / uOutputTexture.y) - 1.0;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
    return aPosition * (uOutputFrame.zw * uInputSize.xy);
}

void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`;

export class DropShadowFilter extends PIXI.Filter {
    constructor(distance: number = 10, angle: number = 45, color: number = 0x000000, alpha: number = 0.5) {
        super({
            glProgram: new PIXI.GlProgram({
                vertex,
                fragment,
                name: 'drop-shadow-filter',
            }),
            resources: {
                dropShadowUniforms: {
                    uOffset: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
                    uColor: { value: new Float32Array([0, 0, 0, 1]), type: 'vec4<f32>' },
                    uAlpha: { value: alpha, type: 'f32' },
                }
            }
        });

        this.distance = distance;
        this.angle = angle;
        this.color = color;
        this.alpha = alpha;

        // Ensure padding effectively so shadow isn't clipped
        this.padding = distance + 10;
    }

    private _distance: number = 10;
    private _angle: number = 45;

    get distance() { return this._distance; }
    set distance(value: number) {
        this._distance = value;
        this.updateOffset();
    }

    get angle() { return this._angle; }
    set angle(value: number) {
        this._angle = value;
        this.updateOffset();
    }

    set color(value: number) {
        const rgb = PIXI.Color.shared.setValue(value).toArray();
        this.resources.dropShadowUniforms.uniforms.uColor = new Float32Array([...rgb, 1.0]);
    }

    set alpha(value: number) {
        this.resources.dropShadowUniforms.uniforms.uAlpha = value;
    }

    private updateOffset() {
        const rad = this.angle * (Math.PI / 180);
        const x = Math.cos(rad) * this.distance;
        const y = Math.sin(rad) * this.distance;
        this.resources.dropShadowUniforms.uniforms.uOffset = new Float32Array([x, y]);
        this.padding = this.distance + 10;
    }
}
