import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { PhoneFrame } from "./components/PhoneFrame";
import { SessionProvider } from "./context/Session";
import { ToastProvider } from "./context/Toasts";
import { DevCutoffProvider } from "./context/DevCutoff";
import { DevPanel } from "../devpanel/DevPanel";

// Home
import Home from "./screens/home/Home";

// Purchase (§3.2)
import FundDetail from "./screens/invest/FundDetail";
import InvestConfigure from "./screens/invest/InvestConfigure";
import OrderProgress from "./screens/invest/OrderProgress";
import ChoosePayment from "./screens/invest/ChoosePayment";
import PaymentScreen from "./screens/invest/PaymentScreen";
import NetBankingPay from "./screens/invest/NetBankingPay";
import AutopayPay from "./screens/invest/AutopayPay";

// SIP (§3.3)
import SipAutopay from "./screens/sip/SipAutopay";
import SipConfirmed from "./screens/sip/SipConfirmed";
import SipManage from "./screens/sip/SipManage";

// Redemption (§3.4)
import HoldingDetail from "./screens/redeem/HoldingDetail";
import RedeemAmount from "./screens/redeem/RedeemAmount";
import RedeemReview from "./screens/redeem/RedeemReview";
import RedeemProgress from "./screens/redeem/RedeemProgress";

// Switch / STP / SWP (§4)
import SwitchPick from "./screens/move/SwitchPick";
import SwitchReview from "./screens/move/SwitchReview";
import SwitchProgress from "./screens/move/SwitchProgress";
import StpSetup from "./screens/move/StpSetup";
import StpConfirmed from "./screens/move/StpConfirmed";
import SwpSetup from "./screens/move/SwpSetup";
import SwpConfirmed from "./screens/move/SwpConfirmed";

// Docs
import Docs from "./screens/docs/Docs";

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />

        {/* Purchase */}
        <Route path="/invest/fund/:scheme" element={<FundDetail />} />
        <Route path="/invest/configure/:scheme" element={<InvestConfigure />} />
        <Route path="/invest/order/:orderId" element={<OrderProgress />} />
        <Route path="/invest/pay-method/:orderId" element={<ChoosePayment />} />
        <Route path="/invest/pay/:paymentId" element={<PaymentScreen />} />
        <Route path="/invest/netbanking/:paymentId" element={<NetBankingPay />} />
        <Route path="/invest/autopay-debit/:orderId" element={<AutopayPay />} />

        {/* SIP */}
        <Route path="/sip/autopay/:scheme" element={<SipAutopay />} />
        <Route path="/sip/confirmed/:sipId" element={<SipConfirmed />} />
        <Route path="/sip/manage/:sipId" element={<SipManage />} />

        {/* Redemption */}
        <Route path="/holding/:holdingId" element={<HoldingDetail />} />
        <Route path="/redeem/:holdingId/amount" element={<RedeemAmount />} />
        <Route path="/redeem/:holdingId/review" element={<RedeemReview />} />
        <Route path="/redeem/order/:orderId" element={<RedeemProgress />} />

        {/* Switch / STP / SWP */}
        <Route path="/switch/:holdingId" element={<SwitchPick />} />
        <Route path="/switch/:holdingId/review" element={<SwitchReview />} />
        <Route path="/switch/order/:orderId" element={<SwitchProgress />} />
        <Route path="/stp/:holdingId/setup" element={<StpSetup />} />
        <Route path="/stp/confirmed/:stpId" element={<StpConfirmed />} />
        <Route path="/swp/:holdingId/setup" element={<SwpSetup />} />
        <Route path="/swp/confirmed/:swpId" element={<SwpConfirmed />} />

        {/* Docs */}
        <Route path="/docs" element={<Docs />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <DevCutoffProvider>
        <PhoneFrame>
          <ToastProvider>
            <AnimatedRoutes />
          </ToastProvider>
        </PhoneFrame>
        <DevPanel />
      </DevCutoffProvider>
    </SessionProvider>
  );
}
