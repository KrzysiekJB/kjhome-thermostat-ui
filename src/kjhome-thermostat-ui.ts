/* eslint-disable @typescript-eslint/no-explicit-any */
import { LitElement, html, TemplateResult, css, PropertyValues, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators';
import {
    HomeAssistant,
    hasConfigOrEntityChanged,
    hasAction,
    ActionHandlerEvent,
    handleAction,
    LovelaceCardEditor,
    getLovelace,
} from 'custom-card-helpers'; // This is a community maintained npm module with common helper functions/types. https://github.com/custom-cards/custom-card-helpers

import type { BoilerplateCardConfig } from './types';
import { actionHandler } from './action-handler-directive';
import { CARD_VERSION } from './const';
import { localize } from './localize/localize';

import { mdiMinus, mdiPlus, mdiDotsVertical } from "@mdi/js";


/* eslint no-console: 0 */
console.info(
    `%c  BOILERPLATE-CARD \n%c  ${localize('common.version')} ${CARD_VERSION}    `,
    'color: orange; font-weight: bold; background: black',
    'color: white; font-weight: bold; background: dimgray',
);

// This puts your card into the UI card picker dialog
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
    type: 'kjhome-thermostat-ui',
    name: 'KJHome Thermostat UI',
    description: 'A template custom card KJHome Thermostat UI',
});

// TODO Name your custom element
@customElement('kjhome-thermostat-ui')
export class BoilerplateCard extends LitElement {
//   public static async getConfigElement(): Promise<LovelaceCardEditor> {
//     await import('./editor');
//     return document.createElement('boilerplate-card-editor');
//   }

    public static getStubConfig(): Record<string, unknown> {
        return {};
    }

    // TODO Add any properities that should cause your element to re-render here
    // https://lit.dev/docs/components/properties/
    @property({ attribute: false }) public hass!: HomeAssistant;

    @state() private config!: BoilerplateCardConfig;

    @state() private tempSetpoint: number | null = null;

    private _featureContext = {};

    // https://lit.dev/docs/components/properties/#accessors-custom
    public setConfig(config: BoilerplateCardConfig): void {
        // TODO Check for required fields and that they are of the proper format
        if (!config) {
        throw new Error(localize('common.invalid_configuration'));
    }

    if (config.test_gui) {
        getLovelace().setEditMode(true);
    }

    this.config = {
        name: config.name || 'KJHome Thermostat',
        ...config,
    };
    this._featureContext = {
        entity_id: config.entity,
    };
    }

    // https://lit.dev/docs/components/lifecycle/#reactive-update-cycle-performing
    protected shouldUpdate(changedProps: PropertyValues): boolean {
        if (!this.config) {
            return false;
        }

        return hasConfigOrEntityChanged(this, changedProps, false);
    }

    private _handleValueChanging(ev: CustomEvent): void {
        this.tempSetpoint = ev.detail.value;
    }

    private _handleValueChanged(ev: CustomEvent): void {
        // wywołanie serwisu tylko na końcu przesuwania
        const newTemp = ev.detail.value;
        //if (!newTemp || !this.config.entity) return;

        this.tempSetpoint = null;

        this.hass.callService('climate', 'set_temperature', {
            entity_id: this.config.entity,
            temperature: newTemp,
        });
    }

    private _renderTemperatureButtons(target: "value" | "low" | "high", colored = false) {
        
        if (!this.hass || !this.config || !this.config.entity) {
            return html`<hui-warning>${localize('common.show_warning')}</hui-warning>`;
        }

        const stateObj = this.hass.states[this.config.entity];
        if (!stateObj) return html``;

        const lowColor = "var(--state-color-hergba(30, 26, 26, 1)#f00)"; // przykładowy kolor
        const highColor = "var(--state-color-cool, #00f)";

        const color =
            colored && stateObj.state !== "off"
            ? target === "high"
                ? highColor
                : lowColor
            : undefined;

        return html`
            <div class="buttons">
            <ha-outlined-icon-button
                style="--md-sys-color-outline: ${color}"
                @click=${() => this._handleButtonClick(target, -stateObj.attributes.target_temp_step)}
                title="Decrease"
            >
                <ha-svg-icon .path=${mdiMinus}></ha-svg-icon>
            </ha-outlined-icon-button>
            <ha-outlined-icon-button
                style="--md-sys-color-outline: ${color}"
                @click=${() => this._handleButtonClick(target, stateObj.attributes.target_temp_step)}
                title="Increase"
            >
                <ha-svg-icon .path=${mdiPlus}></ha-svg-icon>
            </ha-outlined-icon-button>
            </div>
        `;
    }

    private _handleButtonClick(target: "value" | "low" | "high", step: number) {

        if (!this.hass || !this.config || !this.config.entity) {
            return;
        }

        const stateObj = this.hass.states[this.config.entity];
        if (!stateObj) return;

        const currentValue = target === "value"
            ? stateObj.attributes.temperature
            : target === "low"
            ? stateObj.attributes.target_temp_low
            : stateObj.attributes.target_temp_high;

        if (typeof currentValue !== "number") return;

        let newValue = currentValue + step;
        const minTemp = stateObj.attributes.min_temp;
        const maxTemp = stateObj.attributes.max_temp;

        newValue = Math.min(Math.max(newValue, minTemp), maxTemp);

        this.hass.callService("climate", "set_temperature", {
            entity_id: this.config.entity,
            temperature: newValue,
        });
    }
    
    private _renderTarget(): TemplateResult {
        if (!this.hass || !this.config || !this.config.entity) {
            return html``;
        }
        const stateObj = this.hass.states[this.config.entity];
        if (!stateObj) return html``;

        const temperature = this.tempSetpoint !== null ? this.tempSetpoint : stateObj.attributes.temperature;

        if (temperature === undefined || temperature === null) {
            return html``;
        }

        const digits = (stateObj.attributes.target_temp_step ?? 0.5).toString().split(".")?.[1]?.length ?? 0;
        const formatOptions: Intl.NumberFormatOptions = {
            maximumFractionDigits: digits,
            minimumFractionDigits: digits,
        };

        const unit = this.hass.config.unit_system.temperature;

        // Renderowanie z dużym stylem (big) jak w oryginalnej metodzie
        return html`
            <ha-big-number
                class="target-temperature"
                .value=${temperature}
                .unit=${unit}
                .hass=${this.hass}
                .formatOptions=${formatOptions}
            ></ha-big-number>
        `;
    }


    // https://lit.dev/docs/components/rendering/
    protected render(): TemplateResult | void {
        // TODO Check for stateObj or other necessary things and render a warning if missing
        if (!this.hass || !this.config || !this.config.entity) {
            return html`<hui-warning>${localize('common.show_warning')}</hui-warning>`;
        }

        if (this.config.show_error) {
            return this._showError(localize('common.show_error'));
        }

        const stateObj = this.hass.states[this.config.entity];
        const humidityState = this.hass.states['sensor.living_room_humidity'];
        const ringColor = this.config.ring_color ?? 'var(--state-climate-heat-color, var(--state-active-color))';
        
        if (!stateObj) {
            return html`<hui-warning>${localize('common.entity_not_found')}</hui-warning>`;
        }


        return html`
        <ha-card
            tabindex="0"
            .label=${`KJHome: ${this.config.entity || 'No Entity Defined'}`}
            >
            <p class="title">KJHome ${this.config.name}</p>
            <div class="container">
                <ha-control-circular-slider
                    style="--control-circular-slider-color: ${ringColor};"
                    .preventInteractionOnScroll=${true}
                    .value=${stateObj.attributes.temperature}
                    .min=${stateObj.attributes.min_temp}
                    .max=${stateObj.attributes.max_temp}
                    .current=${stateObj.attributes.current_temperature}
                    .step=${stateObj.attributes.target_temp_step ?? 0.5}
                    @value-changing=${this._handleValueChanging}
                    @value-changed=${this._handleValueChanged}
                ></ha-control-circular-slider>
                ${this._renderTarget()}
            </div>

            

            <div class="buttons-container">
                ${this._renderTemperatureButtons("value", true)}
            </div>

            <ha-icon-button
                class="more-info"
                .label=${this.hass!.localize("ui.panel.lovelace.cards.show_more_info")}
                .path=${mdiDotsVertical}
                @click=${this._handleMoreInfo}
                tabindex="0"
            ></ha-icon-button>
        </ha-card>
        
        `;
    }

    // private _handleAction(ev: ActionHandlerEvent): void {
    //     if (this.hass && this.config && ev.detail.action) {
    //     handleAction(this, this.hass, this.config, ev.detail.action);
    //     }
    // }

    // private _showWarning(warning: string): TemplateResult {
    //     return html` <hui-warning>${warning}</hui-warning> `;
    // }

    private _showError(error: string): TemplateResult {
        const errorCard = document.createElement('hui-error-card');
        errorCard.setConfig({
        type: 'error',
        error,
        origConfig: this.config,
        });
        return html` ${errorCard} `;
    }

    private _handleMoreInfo() {
        if (!this.config) return;
        this.dispatchEvent(
            new CustomEvent('hass-more-info', {
                detail: { entityId: this.config.entity },
                bubbles: true,
                composed: true,
            })
        );
    }

    // https://lit.dev/docs/components/styles/
    static get styles(): CSSResultGroup {
        return css`
        
            .container {
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                overflow: hidden;
                max-width: 100%;
                box-sizing: border-box;
                flex: 1;
                padding: 10px;
            }
            
            :host {
                display: block;
                overflow-x: hidden;
                max-width: 100vw; /* zapobiega rozszerzaniu poza szerokość ekranu */
            }

            .title {
                width: 100%;
                font-size: var(--ha-font-size-l);
                line-height: var(--ha-line-height-expanded);
                padding: 8px 30px 8px 30px;
                margin: 0;
                text-align: center;
                box-sizing: border-box;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                flex: none;
            }

            .buttons-container {
                display: flex;
                justify-content: center;
                margin-top: -60px; /* mały odstęp od pierścienia */
                pointer-events: auto; /* upewnia się, że przyciski odbierają kliknięcia */
                z-index: 1; /* nad pierścieniem, żeby były interaktywne */
                margin-bottom: 20px;
            }

            .buttons {
                display: flex;
                gap: 26px;
                justify-content: center;
            }

            .buttons ha-outlined-icon-button {
                width: 48px;
                height: 48px;
                --md-sys-icon-size: 28px;
            }

            .more-info {
                position: absolute;
                cursor: pointer;
                top: 0;
                right: 0;
                inset-inline-end: 0px;
                inset-inline-start: initial;
                border-radius: var(--ha-border-radius-pill);
                color: var(--secondary-text-color);
                direction: var(--direction);
            }

            .target-temperature {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -70%);
                pointer-events: none;
                user-select: none;
                color: var(--primary-text-color);
            }
                
        `;
    }
}
