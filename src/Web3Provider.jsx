const React = require('react');
const PropTypes = require('prop-types');
const isEmpty = require('lodash/isEmpty');
const range = require('lodash/range');
const AccountUnavailable = require('./AccountUnavailable');
const Web3Unavailable = require('./Web3Unavailable');

const ONE_SECOND = 1000;
const ONE_MINUTE = ONE_SECOND * 60;
const propTypes = {
  web3UnavailableScreen: PropTypes.any,
  accountUnavailableScreen: PropTypes.any,
  onChangeAccount: PropTypes.func
};
const defaultProps = {
  passive: false,
  web3UnavailableScreen: Web3Unavailable,
  accountUnavailableScreen: AccountUnavailable
};
const childContextTypes = {
  web3: PropTypes.shape({
    accounts: PropTypes.array,
    selectedAccount: PropTypes.string,
    network: PropTypes.string,
    networkId: PropTypes.number
  })
};

class Web3Provider extends React.Component {

  static contextTypes = {
    store: PropTypes.object
  };

  constructor(props, context) {
    console.log("consturctor")
    super(props, context);
    // const accounts = this.getAccounts();

    this.state = {
      accounts: [],
      networkId: null,
      networkError: null
    };
    this.interval = null;
    this.networkInterval = null;
    this.fetchAccounts = this.fetchAccounts.bind(this);
    this.fetchNetwork = this.fetchNetwork.bind(this);

    if (accounts) {
      this.handleAccounts(accounts, true);
    }
  }

  getChildContext() {
    console.log("getChildContext")
    return {
      web3: {
        accounts: this.state.accounts,
        selectedAccount: this.state.accounts && this.state.accounts[0],
        network: getNetwork(this.state.networkId),
        networkId: this.state.networkId
      }
    };
  }

  componentWillMount() {
    this.fetchAccounts();
  }

  /**
   * Start polling accounts, & network. We poll indefinitely so that we can
   * react to the user changing accounts or netowrks.
   */
  componentDidMount() {
    // console.log("componentDidMount")
    this.fetchAccounts();
    this.fetchNetwork();
    this.initPoll();
    this.initNetworkPoll();
  }

  /**
   * Init web3/account polling, and prevent duplicate interval.
   * @return {void}
   */
  initPoll() {
    console.log('initPoll')
    if (!this.interval) {
      this.interval = setInterval(this.fetchAccounts, ONE_SECOND);
    }
  }

  /**
   * Init network polling, and prevent duplicate intervals.
   * @return {void}
   */
  initNetworkPoll() {
    console.log("initNetworkPoll")
    if (!this.networkInterval) {
      this.networkInterval = setInterval(this.fetchNetwork, ONE_MINUTE);
    }
  }

  /**
   * Update state regarding the availability of web3 and an ETH account.
   * @return {void}
   */
  fetchAccounts() {
    console.log("fetch accounts")
    const { ethereum } = window;
    const ethAccounts = this.getAccounts();
    if (isEmpty(ethAccounts)) {
      ethereum && ethereum.enable()
        .then((accounts) => {
          this.handleAccounts(accounts)
        })
        .catch((err) => {
           this.setState({ accountsError: err});
        });

    } else {
      this.handleAccounts(ethAccounts);
    }
  }

  handleAccounts(accounts, isConstructor = false) {
    console.log("handleAccounts")
    const { onChangeAccount } = this.props;
    const { store } = this.context;
    let next = accounts[0];
    let curr = this.state.accounts[0];
    next = next && next.toLowerCase();
    curr = curr && curr.toLowerCase();
    const didChange = curr && next && (curr !== next);

    if (isEmpty(this.state.accounts) && !isEmpty(accounts)) {
      this.setState({
        accountsError: null,
        accounts: accounts
      });
    }

    if (didChange && !isConstructor) {
      this.setState({
        accountsError: null,
        accounts
      });
    }

    // If provided, execute callback
    if (didChange && typeof onChangeAccount === 'function') {
      onChangeAccount(next);
    }

    // If available, dispatch redux action
    if (store && typeof store.dispatch === 'function') {
      const didLogin = !curr && next;
      const didLogout = curr && !next;

      if (didLogout) {
        store.dispatch({
          type: 'web3/LOGOUT',
          address: null
        })
      } else if (didLogin || (isConstructor && next)) {
        store.dispatch({
          type: 'web3/RECEIVE_ACCOUNT',
          address: next
        });
      } else if (didChange) {
        store.dispatch({
          type: 'web3/CHANGE_ACCOUNT',
          address: next
        })
      }
    }
  }

  /**
   * Get the network and update state accordingly.
   * @return {void}
   */
  fetchNetwork() {
    console.log("fetchNetworks")
    const { web3 } = window;

    if (web3) {
      const isV1 = /^1/.test(web3.version);
      const getNetwork = isV1 ? web3.eth.net.getId : web3.version.getNetwork;

      getNetwork((err, netId) => {
        if (err) {
          this.setState({
            networkError: err
          });
        } else {
          if (netId != this.state.networkId) {
            this.setState({
              networkError: null,
              networkId: netId
            })
          }
        }
      });
    }

  }

  /**
   * Get the account. We wrap in try/catch because reading `web3.eth.accounts`
   * will throw if no account is selected.
   * @return {String}
   */
  async getAccounts() {
    console.log("getAccounts")
    const { web3 } = window;

    try {
      const { web3 } = window;
      const isV1 = /^1/.test(web3.version);
      // throws if no account selected
      const getV1Wallets = () => range(web3.eth.accounts.wallet.length).map(i => web3.eth.accounts.wallet[i]).map(w => w.address);
      console.log('isV1?', isV1)

      const accounts = isV1 ? getV1Wallets() : await ethereum.enable()
      console.log("getAccounts accounts: ", accounts)
      return accounts;
    } catch (e) {
      console.log("error thrown", e)
      return [];
    }
  }

  render() {
    console.log("render")
    const { web3 } = window;
    const {
      passive,
      web3UnavailableScreen: Web3UnavailableComponent,
      accountUnavailableScreen: AccountUnavailableComponent
    } = this.props;

    if (passive) {
      return this.props.children;
    }

    if (!web3) {
      return <Web3UnavailableComponent />;
    }

    console.log('accounts: ', this.state.accounts)
    if (isEmpty(this.state.accounts)) {
      return <AccountUnavailableComponent />;
    }

    return this.props.children;
  }
}

Web3Provider.propTypes = propTypes;
Web3Provider.defaultProps = defaultProps;
Web3Provider.childContextTypes = childContextTypes;

module.exports = Web3Provider;

/* =============================================================================
=    Deps
============================================================================= */
function getNetwork(networkId) {
  switch (networkId) {
    case '1':
      return 'MAINNET';
    case '2':
      return 'MORDEN';
    case '3':
      return 'ROPSTEN';
    case '4':
      return 'RINKEBY';
    case '42':
      return 'KOVAN';
    default:
      return 'UNKNOWN';
  }
}
