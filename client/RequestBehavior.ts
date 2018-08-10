import {RequestType} from "../src/lib/RequestTypes";
import {PostMessageRpcClient, RedirectRpcClient} from "@nimiq/rpc";

export class RequestBehavior {
    private readonly _type: BehaviorType;

    constructor(type: BehaviorType) {
        this._type = type;
    }

    async request(endpoint: string, command: RequestType, args: any[]): Promise<any> {
        throw new Error('Not implemented');
    }

    get type() {
        return this._type;
    }

    static getAllowedOrigin(endpoint: string) {
        // FIXME derive from endpoint url
        return '*';
    }
}

enum BehaviorType {
    REDIRECT,
    POPUP
}

export class RedirectRequestBehavior extends RequestBehavior {
    private readonly _targetUrl: string;
    private readonly _localState: any;

    static withLocalState(localState: any) {
        return new RedirectRequestBehavior(undefined, localState);
    }

    constructor(targetUrl?: string, localState?: any) {
        super(BehaviorType.REDIRECT);
        const location = window.location;
        this._targetUrl = targetUrl || `${location.protocol}//${location.hostname}:${location.port}${location.pathname}`;;
        this._localState = localState || {};

        // Reject local state with reserved property.
        if (typeof this._localState.__command !== 'undefined') {
            throw new Error('Invalid localState: Property \'__command\' is reserved');
        }
    }

    async request(endpoint: string, command: RequestType, args: any[]): Promise<any> {
        const origin = RequestBehavior.getAllowedOrigin(endpoint);

        const client = new RedirectRpcClient(endpoint, origin);
        await client.init();

        const state = Object.assign({ __command: command }, this._localState);
        console.log('state', state);
        client.callAndSaveLocalState(this._targetUrl, state, command, ...args);
    }
}

export class PopupRequestBehavior extends RequestBehavior {
    private static DEFAULT_OPTIONS: string = '';
    private _options: string;

    constructor(options = PopupRequestBehavior.DEFAULT_OPTIONS) {
        super(BehaviorType.POPUP);
        this._options = options;
    }

    async request(endpoint: string, command: RequestType, args: any[]): Promise<any> {
        const origin = RequestBehavior.getAllowedOrigin(endpoint);

        const popup = this.createPopup(endpoint);
        const client = new PostMessageRpcClient(popup, origin);
        await client.init();

        try {
            const result = await client.call(command, ...args);
            client.close();
            popup.close();
            return result;
        } catch (e) {
            client.close();
            popup.close();
            throw e;
        }
    }

    createPopup(url: string) {
        const popup = window.open(url, 'NimiqAccounts', this._options);
        if (!popup) {
            throw new Error('Failed to open popup');
        }
        return popup;
    }
}
