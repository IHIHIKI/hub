<template>
    <div class="container">
        <PaymentInfoLine v-if="rpcState" style="color: white"
                         :amount="request.value"
                         :networkFee="request.fee"
                         :networkFeeEditable="false"
                         :origin="rpcState.origin"/>
        <small-page>
            <router-view/>
        </small-page>
        <a class="global-close" :class="{hidden: $route.name === `checkout-success`}" @click="close">Cancel Payment</a>
    </div>
</template>

<script lang="ts">
import {Component, Emit, Prop, Watch, Vue} from 'vue-property-decorator';
import {AccountSelector, LoginSelector, PaymentInfoLine, SmallPage} from '@nimiq/vue-components';
import {RequestType, ParsedCheckoutRequest} from '../lib/RequestTypes';
import {AddressInfo} from '../lib/AddressInfo';
import {KeyInfo, KeyStorageType} from '../lib/KeyInfo';
import {State, Mutation, Getter} from 'vuex-class';
import RpcApi from '../lib/RpcApi';
import {SignTransactionResult} from '@nimiq/keyguard-client';
import {ResponseStatus, State as RpcState} from '@nimiq/rpc';

@Component({components: {PaymentInfoLine, SmallPage}})
export default class Checkout extends Vue {
    @State private rpcState!: RpcState;
    @State private request!: ParsedCheckoutRequest;
    @State private keyguardResult!: SignTransactionResult | Error | null;
    @State private activeAccountPath!: string;

    @Watch('keyguardResult', {immediate: true})
    private onKeyguardResult() {
        if (this.keyguardResult instanceof Error) {
            //
        } else if (this.keyguardResult && this.rpcState) {
            // Forward signing result to original caller window
            this.rpcState.reply(ResponseStatus.OK, this.keyguardResult);
        }
    }

    @Emit()
    private close() {
        window.close();
    }
}
</script>

<style scoped>
    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .global-close {
        display: inline-block;
        height: 27px;
        border-radius: 13.5px;
        background-color: rgba(0, 0, 0, 0.1);
        font-size: 14px;
        font-weight: 600;
        line-height: 27px;
        color: white;
        padding: 0 12px;
        cursor: pointer;
        margin-top: 64px;
        margin-bottom: 40px;
    }

    .global-close::before {
        content: '';
        display: inline-block;
        height: 11px;
        width: 11px;
        background-image: url('data:image/svg+xml,<svg height="24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h24v24H0z" fill="none"/><path fill="%23fff" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>');
        background-repeat: no-repeat;
        background-size: 16px;
        background-position: center;
        margin-right: 8px;
        margin-bottom: -1px;
    }

    .global-close.hidden {
        visibility: hidden;
        pointer-events: none;
    }
</style>