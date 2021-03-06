import {EnableCameraSceneName} from "./EnableCameraScene";
import Rectangle = Phaser.GameObjects.Rectangle;
import {loadAllLayers} from "../Entity/PlayerTexturesLoadingManager";
import Sprite = Phaser.GameObjects.Sprite;
import Container = Phaser.GameObjects.Container;
import {gameManager} from "../Game/GameManager";
import {localUserStore} from "../../Connexion/LocalUserStore";
import {addLoader} from "../Components/Loader";
import type {BodyResourceDescriptionInterface} from "../Entity/PlayerTextures";
import {AbstractCharacterScene} from "./AbstractCharacterScene";
import {areCharacterLayersValid} from "../../Connexion/LocalUser";
import { MenuScene } from "../Menu/MenuScene";
import { SelectCharacterSceneName } from "./SelectCharacterScene";
import {customCharacterSceneVisibleStore} from "../../Stores/CustomCharacterStore";
import {selectCharacterSceneVisibleStore} from "../../Stores/SelectCharacterStore";
import {waScaleManager} from "../Services/WaScaleManager";
import {isMobile} from "../../Enum/EnvironmentVariable";

export const CustomizeSceneName = "CustomizeScene";

export const CustomizeSceneKey = "CustomizeScene";
const customizeSceneKey = 'customizeScene';

export class CustomizeScene extends AbstractCharacterScene {
    private Rectangle!: Rectangle;

    private selectedLayers: number[] = [0];
    private containersRow: Container[][] = [];
    public activeRow:number = 0;
    private layers: BodyResourceDescriptionInterface[][] = [];

    protected lazyloadingAttempt = true; //permit to update texture loaded after renderer

    constructor() {
        super({
            key: CustomizeSceneName
        });
    }

    preload() {
        this.load.html(customizeSceneKey, 'resources/html/CustomCharacterScene.html');

        this.loadCustomSceneSelectCharacters().then((bodyResourceDescriptions) => {
            bodyResourceDescriptions.forEach((bodyResourceDescription) => {
                if(bodyResourceDescription.level == undefined || bodyResourceDescription.level < 0 || bodyResourceDescription.level > 5 ){
                    throw 'Texture level is null';
                }
                this.layers[bodyResourceDescription.level].unshift(bodyResourceDescription);
            });
            this.lazyloadingAttempt = true;
        });

        this.layers = loadAllLayers(this.load);
        this.lazyloadingAttempt = false;


        //this function must stay at the end of preload function
        addLoader(this);
    }

    create() {
        customCharacterSceneVisibleStore.set(true);
        this.events.addListener('wake', () => {
            waScaleManager.saveZoom();
            waScaleManager.zoomModifier = isMobile() ? 3 : 1;
            customCharacterSceneVisibleStore.set(true);
        });

        waScaleManager.saveZoom();
        waScaleManager.zoomModifier = isMobile() ? 3 : 1;

        this.Rectangle = this.add.rectangle(this.cameras.main.worldView.x + this.cameras.main.width / 2, this.cameras.main.worldView.y + this.cameras.main.height / 3, 32, 33)
        this.Rectangle.setStrokeStyle(2, 0xFFFFFF);
        this.add.existing(this.Rectangle);

        this.createCustomizeLayer(0, 0, 0);
        this.createCustomizeLayer(0, 0, 1);
        this.createCustomizeLayer(0, 0, 2);
        this.createCustomizeLayer(0, 0, 3);
        this.createCustomizeLayer(0, 0, 4);
        this.createCustomizeLayer(0, 0, 5);

        this.moveLayers();
        this.input.keyboard.on('keyup-ENTER', () => {
            this.nextSceneToCamera();
        });
        this.input.keyboard.on('keyup-BACKSPACE', () => {
            this.backToPreviousScene();
        });

        this.input.keyboard.on('keyup-RIGHT', () => this.moveCursorHorizontally(1));
        this.input.keyboard.on('keyup-LEFT', () => this.moveCursorHorizontally(-1));
        this.input.keyboard.on('keyup-DOWN', () => this.moveCursorVertically(1));
        this.input.keyboard.on('keyup-UP', () => this.moveCursorVertically(-1));

        const customCursorPosition = localUserStore.getCustomCursorPosition();
        if (customCursorPosition) {
            this.activeRow = customCursorPosition.activeRow;
            this.selectedLayers = customCursorPosition.selectedLayers;
            this.moveLayers();
            this.updateSelectedLayer();
        }

        this.onResize();
    }

    public moveCursorHorizontally(index: number): void {
        this.selectedLayers[this.activeRow] += index;
        if (this.selectedLayers[this.activeRow] < 0) {
            this.selectedLayers[this.activeRow] = 0
        } else if(this.selectedLayers[this.activeRow] > this.layers[this.activeRow].length - 1) {
            this.selectedLayers[this.activeRow] = this.layers[this.activeRow].length - 1
        }
        this.moveLayers();
        this.updateSelectedLayer();
        this.saveInLocalStorage();
    }

    public moveCursorVertically(index:number): void {

        this.activeRow += index;
        if (this.activeRow < 0) {
            this.activeRow = 0
        } else if (this.activeRow > this.layers.length - 1) {
            this.activeRow = this.layers.length - 1
        }
        this.moveLayers();
        this.saveInLocalStorage();
    }

    private saveInLocalStorage() {
        localUserStore.setCustomCursorPosition(this.activeRow, this.selectedLayers);
    }

    /**
     * @param x, the layer's vertical position
     * @param y, the layer's horizontal position
     * @param layerNumber, index of the this.layers array
     * create the layer and display it on the scene
     */
    private createCustomizeLayer(x: number, y: number, layerNumber: number): void {
        this.containersRow[layerNumber] = [];
        this.selectedLayers[layerNumber] = 0;
        let alpha = 0;
        let layerPosX = 0;
        for (let i = 0; i < this.layers[layerNumber].length; i++) {
            const container = this.generateCharacter(300 + x + layerPosX, y, layerNumber, i);

            this.containersRow[layerNumber][i] = container;
            this.add.existing(container);
            layerPosX += 30;
            alpha += 0.1;
        }
    }

    /**
     * Generates a character from the current selected items BUT replaces
     * one layer item with an item we pass in parameter.
     *
     * Current selected items are fetched from this.selectedLayers
     *
     * @param x,
     * @param y,
     * @param layerNumber, The selected layer number (0 for body...)
     * @param selectedItem, The number of the item select (0 for black body...)
     */
    private generateCharacter(x: number, y: number, layerNumber: number, selectedItem: number) {
        return new Container(this, x, y,this.getContainerChildren(layerNumber,selectedItem));
    }

    private getContainerChildren(layerNumber: number, selectedItem: number): Array<Sprite> {
        const children: Array<Sprite> = new Array<Sprite>();
        for (let j = 0; j <= layerNumber; j++) {
            if (j === layerNumber) {
                children.push(this.generateLayers(0, 0, this.layers[j][selectedItem].name));
            } else {
                const layer = this.selectedLayers[j];
                if (layer === undefined) {
                    continue;
                }
                children.push(this.generateLayers(0, 0, this.layers[j][layer].name));
            }
         }
        return children;
    }

    /**
     * Move the layer left, right, up and down and update the selected layer
     */
    private moveLayers(): void {
        const screenCenterX = this.cameras.main.worldView.x + this.cameras.main.width / 2;
        const screenCenterY = this.cameras.main.worldView.y + this.cameras.main.height / 3;
        const screenWidth = this.game.renderer.width;
        const screenHeight = this.game.renderer.height;
        for (let i = 0; i < this.containersRow.length; i++) {
            for (let j = 0; j < this.containersRow[i].length; j++) {
                    let selectedX = this.selectedLayers[i];
                    if (selectedX === undefined) {
                        selectedX = 0;
                    }
                    this.containersRow[i][j].x = screenCenterX + (j - selectedX) * 40;
                    this.containersRow[i][j].y = screenCenterY + (i - this.activeRow) * 40;
                    const alpha1 = Math.abs(selectedX - j)*47*2/screenWidth;
                    const alpha2 = Math.abs(this.activeRow - i)*49*2/screenHeight;
                    this.containersRow[i][j].setAlpha((1 -alpha1)*(1 - alpha2));
            }

        }
    }

    /**
     * @param x, the sprite's vertical position
     * @param y, the sprites's horizontal position
     * @param name, the sprite's name
     * @return a new sprite
     */
    private generateLayers(x: number, y: number, name: string): Sprite {
        return new Sprite(this, x, y, name);
    }

    private updateSelectedLayer() {
        for(let i = 0; i < this.containersRow.length; i++){
            for(let j = 0; j < this.containersRow[i].length; j++){
               const children = this.getContainerChildren(i, j);
               this.containersRow[i][j].removeAll(true);
                this.containersRow[i][j].add(children);
            }
        }
    }

    update(time: number, delta: number): void {

        if(this.lazyloadingAttempt){
            this.moveLayers();
            this.lazyloadingAttempt = false;
        }
    }




     public onResize(): void {
        this.moveLayers();

        this.Rectangle.x = this.cameras.main.worldView.x + this.cameras.main.width / 2;
        this.Rectangle.y = this.cameras.main.worldView.y + this.cameras.main.height / 3;
     }

    private nextSceneToCamera(){
        const layers: string[] = [];
            let i = 0;
            for (const layerItem of this.selectedLayers) {
                if (layerItem !== undefined) {
                    layers.push(this.layers[i][layerItem].name);
                }
                i++;
            }
            if (!areCharacterLayersValid(layers)) {
                return;
            }

            gameManager.setCharacterLayers(layers);
            this.scene.sleep(CustomizeSceneName);
            waScaleManager.restoreZoom();
            this.events.removeListener('wake');
            gameManager.tryResumingGame(this, EnableCameraSceneName);
            customCharacterSceneVisibleStore.set(false);
    }

    private backToPreviousScene(){
        this.scene.sleep(CustomizeSceneName);
        waScaleManager.restoreZoom();
        this.scene.run(SelectCharacterSceneName);
        customCharacterSceneVisibleStore.set(false);
    }
}
