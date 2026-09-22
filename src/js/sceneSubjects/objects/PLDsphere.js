import * as THREE from 'three';
export class PLDsphere {
    constructor(pldId, bone) {
        const geom = new THREE.SphereGeometry(0.15, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00008b });
        this.sphere = new THREE.Mesh(geom, mat);

        this.sphere.Id = pldId;
        this.labelId = pldId;
        this.labelColor = "#ffffff";
        this.outlineColor = "#ffffff";

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = 128;
        canvas.width = canvas.height = size;
        this.labelCanvas = canvas;
        this.labelContext = ctx;
        this.labelTexture = null;
        this.redrawLabel();

        const texture = new THREE.CanvasTexture(canvas);
        this.labelTexture = texture;
        const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(spriteMat);
        this.labelSprite = sprite;
        sprite.userData.pldSpriteRole = "label";

        sprite.scale.set(1, 1, 1);  
        sprite.position.set(0, 0.3, 0);  
        this.sphere.add(sprite);

        const outlineCanvas = document.createElement('canvas');
        const outlineCtx = outlineCanvas.getContext('2d');
        outlineCanvas.width = outlineCanvas.height = size;
        this.outlineCanvas = outlineCanvas;
        this.outlineContext = outlineCtx;
        this.outlineTexture = null;
        this.redrawOutline();

        const outlineTexture = new THREE.CanvasTexture(outlineCanvas);
        this.outlineTexture = outlineTexture;
        const outlineMat = new THREE.SpriteMaterial({
            map: outlineTexture,
            transparent: true,
            depthWrite: false,
        });
        const outlineSprite = new THREE.Sprite(outlineMat);
        outlineSprite.userData.pldSpriteRole = "outline";
        outlineSprite.scale.set(0.52, 0.52, 0.52);
        outlineSprite.position.set(0, 0, 0);
        this.outlineSprite = outlineSprite;
        this.sphere.add(outlineSprite);

        if(bone){
            this.bone = bone;
            this.sphere.name = pldId + '_PLD';
        };

        this.positions = []; 
    }

    redrawLabel() {
        const canvas = this.labelCanvas;
        const ctx = this.labelContext;
        if (!canvas || !ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = this.labelColor || "#ffffff";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 48px Arial';
        ctx.fillText(String(this.labelId), canvas.width / 2, canvas.height / 2);

        if (this.labelTexture) {
            this.labelTexture.needsUpdate = true;
        }
    }

    redrawOutline() {
        const canvas = this.outlineCanvas;
        const ctx = this.outlineContext;
        if (!canvas || !ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width * 0.34, 0, Math.PI * 2);
        ctx.strokeStyle = this.outlineColor || "#ffffff";
        ctx.lineWidth = canvas.width * 0.08;
        ctx.stroke();

        if (this.outlineTexture) {
            this.outlineTexture.needsUpdate = true;
        }
    }

    setColor(colorValue) {
        if (!colorValue || !this.sphere?.material) return;
        if (Array.isArray(this.sphere.material)) {
            this.sphere.material.forEach((mat) => mat?.color?.set?.(colorValue));
            return;
        }
        this.sphere.material.color?.set?.(colorValue);
    }

    setLabelColor(colorValue) {
        if (!colorValue) return;
        this.labelColor = colorValue;
        this.redrawLabel();
    }

    setOutlineColor(colorValue) {
        if (!colorValue) return;
        this.outlineColor = colorValue;
        this.redrawOutline();
    }

    setLabelVisible(visible) {
        if (this.labelSprite) {
            this.labelSprite.visible = !!visible;
        }
    }

    setOutlineVisible(visible) {
        if (this.outlineSprite) {
            this.outlineSprite.visible = !!visible;
        }
    }
}
