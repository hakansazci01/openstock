/**
 * Broker Adapter Interface
 * All broker integrations must implement this interface.
 * Users configure their broker credentials in settings; the adapter handles
 * authentication, order placement, balance sync, and stop-loss orders.
 */

export interface BrokerAccount {
    accountId: string;
    buyingPower: number;
    cash: number;
    equity: number;
    portfolioValue: number;
}

export interface BrokerPosition {
    symbol: string;
    quantity: number;
    averagePrice: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPL: number;
    unrealizedPLPercent: number;
}

export interface BrokerOrder {
    orderId: string;
    symbol: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop' | 'stop_limit';
    quantity: number;
    limitPrice?: number;
    stopPrice?: number;
    status: 'pending' | 'filled' | 'cancelled' | 'rejected' | 'partially_filled';
    filledQuantity: number;
    /** Volume-weighted fill price, when the broker reports it. */
    averagePrice?: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface BrokerAdapter {
    /** Connect to broker with credentials and verify access */
    connect(apiKey: string, apiSecret: string, apiUrl?: string): Promise<boolean>;

    /** Get account information */
    getAccount(): Promise<BrokerAccount>;

    /** Get all open positions */
    getPositions(): Promise<BrokerPosition[]>;

    /** Place a new order */
    placeOrder(order: {
        symbol: string;
        side: 'buy' | 'sell';
        type: 'market' | 'limit' | 'stop' | 'stop_limit';
        quantity: number;
        limitPrice?: number;
        stopPrice?: number;
    }): Promise<BrokerOrder>;

    /** Cancel an order. Binance requires the symbol, Alpaca does not. */
    cancelOrder(orderId: string, symbol?: string): Promise<boolean>;

    /** Get order history. Binance can only list orders for a single symbol. */
    getOrders(symbol?: string): Promise<BrokerOrder[]>;

    /** Get current quote for a symbol */
    getQuote(symbol: string): Promise<{ price: number; bid: number; ask: number; timestamp: Date }>;

    /** Sync broker data to local database */
    sync(): Promise<{
        account: BrokerAccount;
        positions: BrokerPosition[];
        orders: BrokerOrder[];
    }>;
}

/**
 * Base broker adapter class - extend this for each broker
 */
export abstract class BaseBrokerAdapter implements BrokerAdapter {
    protected apiKey: string = '';
    protected apiSecret: string = '';
    protected apiUrl: string = '';

    abstract connect(apiKey: string, apiSecret: string, apiUrl?: string): Promise<boolean>;
    abstract getAccount(): Promise<BrokerAccount>;
    abstract getPositions(): Promise<BrokerPosition[]>;
    abstract placeOrder(order: {
        symbol: string;
        side: 'buy' | 'sell';
        type: 'market' | 'limit' | 'stop' | 'stop_limit';
        quantity: number;
        limitPrice?: number;
        stopPrice?: number;
    }): Promise<BrokerOrder>;
    abstract cancelOrder(orderId: string, symbol?: string): Promise<boolean>;
    abstract getOrders(symbol?: string): Promise<BrokerOrder[]>;
    abstract getQuote(symbol: string): Promise<{ price: number; bid: number; ask: number; timestamp: Date }>;
    abstract sync(): Promise<{
        account: BrokerAccount;
        positions: BrokerPosition[];
        orders: BrokerOrder[];
    }>;

    protected headers(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
        };
    }
}