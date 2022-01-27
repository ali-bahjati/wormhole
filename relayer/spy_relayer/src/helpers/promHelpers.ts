import http = require("http");
import client = require("prom-client");

// NOTE:  To create a new metric:
// 1) Create a private counter/gauge with appropriate name and help
// 2) Create a method to set the metric to a value
// 3) Register the metric

export enum PromMode {
  Listen,
  Relay,
  Both,
}

export class PromHelper {
  private _register = new client.Registry();
  private _walletReg = new client.Registry();
  // private collectDefaultMetrics = client.collectDefaultMetrics;
  private _mode: PromMode;

  // Actual metrics
  private successCounter = new client.Counter({
    name: "successes",
    help: "number of successful relays",
  });
  private failureCounter = new client.Counter({
    name: "failures",
    help: "number of failed relays",
  });
  private completeTime = new client.Histogram({
    name: "complete_time",
    help: "Time is took to complete transfer",
    buckets: [400, 800, 1600, 3200, 6400, 12800],
  });
  private listenCounter = new client.Counter({
    name: "VAAs_received",
    help: "number of VAAs received",
  });
  private alreadyExecutedCounter = new client.Counter({
    name: "already_executed",
    help: "number of transfers rejected due to already having been executed",
  });

  // Wallet metrics
  private demoWalletBalance = new client.Gauge({
    name: "demo_wallet_balance",
    help: "The balance of a fake wallet",
    labelNames: ["timestamp"],
    registers: [this._walletReg],
  });
  // End metrics

  private server = http.createServer(async (req, res) => {
    // console.log("promHelpers received a request: ", req);
    if (req.url === "/metrics") {
      // Return all metrics in the Prometheus exposition format
      if (this._mode === PromMode.Listen || this._mode == PromMode.Both) {
        res.setHeader("Content-Type", this._register.contentType);
        res.end(await this._register.metrics());
      }
      if (this._mode === PromMode.Relay || this._mode == PromMode.Both) {
        res.setHeader("Content-Type", this._register.contentType);
        res.write(await this._register.metrics());
        res.write("\n");
        res.end(await this._walletReg.metrics());
      }
    }
  });

  constructor(name: string, port: number, mode: PromMode) {
    this._register.setDefaultLabels({
      app: name,
    });
    // this.collectDefaultMetrics({ register: this.register });

    this._mode = mode;
    // Register each metric
    if (this._mode === PromMode.Listen || this._mode == PromMode.Both) {
      this._register.registerMetric(this.listenCounter);
    }
    if (this._mode === PromMode.Relay || this._mode == PromMode.Both) {
      this._register.registerMetric(this.successCounter);
      this._register.registerMetric(this.failureCounter);
      this._register.registerMetric(this.alreadyExecutedCounter);
    }
    // End registering metric

    this.server.listen(port);
  }

  // These are the accessor methods for the metrics
  incSuccesses() {
    this.successCounter.inc();
  }
  incFailures() {
    this.failureCounter.inc();
  }
  addCompleteTime(val: number) {
    this.completeTime.observe(val);
  }
  incIncoming() {
    this.listenCounter.inc();
  }
  incAlreadyExec() {
    this.alreadyExecutedCounter.inc();
  }

  // Wallet metrics
  setDemoWalletBalance(bal: number) {
    this._walletReg.clear();
    // this.walletReg = new client.Registry();
    this.demoWalletBalance = new client.Gauge({
      name: "demo_wallet_balance",
      help: "The balance of a fake wallet",
      labelNames: ["timestamp"],
      registers: [this._walletReg],
    });
    this._walletReg.registerMetric(this.demoWalletBalance);
    let now = new Date();
    // this.walletDate = now.toString();
    this.demoWalletBalance.set({ timestamp: now.toString() }, bal);
    // this.walletBalance.set(bal);
  }
}
