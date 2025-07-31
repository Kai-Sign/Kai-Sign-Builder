/**
 * Advanced Hardware Device Simulator
 * Provides realistic signing flow simulation for multiple hardware devices
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface DeviceType {
  id: 'stax' | 'flex' | 'nano-s' | 'nano-x' | 'trezor' | 'keepkey';
  name: string;
  screenSize: { width: number; height: number };
  hasTouch: boolean;
  buttonCount: number;
  displayType: 'e-ink' | 'oled' | 'lcd';
}

export interface SigningStep {
  id: string;
  title: string;
  description: string;
  screen: React.ReactNode;
  userAction: 'tap' | 'swipe' | 'button-press' | 'hold' | 'review';
  duration: number;
  isSkippable: boolean;
  warnings?: string[];
  tips?: string[];
}

export interface Transaction {
  to: string;
  value: string;
  data: string;
  gasLimit: string;
  gasPrice: string;
  nonce: number;
  chainId: number;
}

export interface SimulationConfig {
  device: DeviceType;
  showTips: boolean;
  simulationSpeed: 'slow' | 'normal' | 'fast';
  enableHapticFeedback: boolean;
  showSecurityWarnings: boolean;
  educationMode: boolean;
}

const DEVICE_TYPES: DeviceType[] = [
  {
    id: 'stax',
    name: 'Ledger Stax',
    screenSize: { width: 400, height: 672 },
    hasTouch: true,
    buttonCount: 0,
    displayType: 'e-ink'
  },
  {
    id: 'flex',
    name: 'Ledger Flex',
    screenSize: { width: 480, height: 600 },
    hasTouch: true,
    buttonCount: 0,
    displayType: 'e-ink'
  },
  {
    id: 'nano-x',
    name: 'Ledger Nano X',
    screenSize: { width: 128, height: 64 },
    hasTouch: false,
    buttonCount: 2,
    displayType: 'oled'
  },
  {
    id: 'nano-s',
    name: 'Ledger Nano S',
    screenSize: { width: 128, height: 32 },
    hasTouch: false,
    buttonCount: 2,
    displayType: 'oled'
  },
  {
    id: 'trezor',
    name: 'Trezor Model T',
    screenSize: { width: 240, height: 240 },
    hasTouch: true,
    buttonCount: 0,
    displayType: 'lcd'
  }
];

export const EnhancedDeviceSimulator: React.FC<{
  transaction: Transaction;
  erc7730Spec: any;
  onComplete: (approved: boolean) => void;
  config?: Partial<SimulationConfig>;
}> = ({ transaction, erc7730Spec, onComplete, config = {} }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceType>(DEVICE_TYPES[0]);
  const [signingSteps, setSigningSteps] = useState<SigningStep[]>([]);
  const [userProgress, setUserProgress] = useState<Record<string, boolean>>({});
  const [showEducation, setShowEducation] = useState(false);

  const simulationConfig: SimulationConfig = {
    device: selectedDevice,
    showTips: true,
    simulationSpeed: 'normal',
    enableHapticFeedback: true,
    showSecurityWarnings: true,
    educationMode: false,
    ...config
  };

  // Generate signing steps based on device and transaction
  const generateSigningSteps = useCallback((device: DeviceType, tx: Transaction): SigningStep[] => {
    const steps: SigningStep[] = [];

    // Step 1: Connection verification
    steps.push({
      id: 'connect',
      title: 'Connect Device',
      description: 'Ensure your device is connected and unlocked',
      screen: <ConnectionScreen device={device} />,
      userAction: 'review',
      duration: 2000,
      isSkippable: false,
      tips: ['Make sure your device is unlocked', 'Check USB connection']
    });

    // Step 2: App verification
    steps.push({
      id: 'app',
      title: 'Open Ethereum App',
      description: 'Navigate to and open the Ethereum application',
      screen: <AppSelectionScreen device={device} />,
      userAction: device.hasTouch ? 'tap' : 'button-press',
      duration: 3000,
      isSkippable: false,
      tips: ['Look for the Ethereum logo', 'App must be up to date']
    });

    // Step 3: Transaction review
    steps.push({
      id: 'review',
      title: 'Review Transaction',
      description: 'Carefully review all transaction details',
      screen: <TransactionReviewScreen device={device} transaction={tx} spec={erc7730Spec} />,
      userAction: 'review',
      duration: 0, // User-controlled
      isSkippable: false,
      warnings: [
        'Verify the recipient address carefully',
        'Check the amount being sent',
        'Ensure gas price is reasonable'
      ]
    });

    // Step 4: Security warnings (if applicable)
    if (simulationConfig.showSecurityWarnings && hasSecurityRisks(tx)) {
      steps.push({
        id: 'security',
        title: 'Security Warning',
        description: 'Important security considerations detected',
        screen: <SecurityWarningScreen device={device} risks={getSecurityRisks(tx)} />,
        userAction: 'review',
        duration: 5000,
        isSkippable: false,
        warnings: getSecurityRisks(tx)
      });
    }

    // Step 5: Final confirmation
    steps.push({
      id: 'confirm',
      title: 'Confirm Transaction',
      description: 'Final confirmation to sign the transaction',
      screen: <ConfirmationScreen device={device} />,
      userAction: device.hasTouch ? 'hold' : 'button-press',
      duration: 3000,
      isSkippable: false,
      tips: [
        device.hasTouch ? 'Hold to confirm' : 'Press both buttons simultaneously',
        'This action cannot be undone'
      ]
    });

    return steps;
  }, [simulationConfig.showSecurityWarnings, erc7730Spec]);

  // Initialize signing steps when device or transaction changes
  useEffect(() => {
    const steps = generateSigningSteps(selectedDevice, transaction);
    setSigningSteps(steps);
    setCurrentStep(0);
    setUserProgress({});
  }, [selectedDevice, transaction, generateSigningSteps]);

  const startSimulation = () => {
    setIsSimulating(true);
    setCurrentStep(0);
  };

  const nextStep = () => {
    if (currentStep < signingSteps.length - 1) {
      setUserProgress(prev => ({ ...prev, [signingSteps[currentStep].id]: true }));
      setCurrentStep(prev => prev + 1);
    } else {
      // Simulation complete
      setIsSimulating(false);
      onComplete(true);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const cancelSimulation = () => {
    setIsSimulating(false);
    onComplete(false);
  };

  const getStepDuration = (step: SigningStep) => {
    const multipliers = { slow: 1.5, normal: 1, fast: 0.5 };
    return step.duration * multipliers[simulationConfig.simulationSpeed];
  };

  const currentStepData = signingSteps[currentStep];

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Device Selection */}
      {!isSimulating && (
        <DeviceSelection
          devices={DEVICE_TYPES}
          selectedDevice={selectedDevice}
          onSelectDevice={setSelectedDevice}
        />
      )}

      {/* Simulation Controls */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Hardware Wallet Simulation</h2>
        <div className="flex gap-2">
          {!isSimulating ? (
            <button
              onClick={startSimulation}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Start Simulation
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={prevStep}
                disabled={currentStep === 0}
                className="px-3 py-1 bg-gray-300 text-gray-700 rounded disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={nextStep}
                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
              >
                {currentStep === signingSteps.length - 1 ? 'Confirm' : 'Next'}
              </button>
              <button
                onClick={cancelSimulation}
                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Cancel
              </button>
            </div>
          )}
          <button
            onClick={() => setShowEducation(!showEducation)}
            className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            {showEducation ? 'Hide' : 'Show'} Education
          </button>
        </div>
      </div>

      {/* Progress Indicator */}
      {isSimulating && (
        <ProgressIndicator
          steps={signingSteps}
          currentStep={currentStep}
          completedSteps={userProgress}
        />
      )}

      {/* Main Simulation Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device Display */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {isSimulating && currentStepData && (
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.3 }}
              >
                <DeviceDisplay
                  device={selectedDevice}
                  step={currentStepData}
                  onUserAction={nextStep}
                  config={simulationConfig}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Information Panel */}
        <div className="space-y-4">
          {/* Current Step Info */}
          {isSimulating && currentStepData && (
            <StepInformation
              step={currentStepData}
              showTips={simulationConfig.showTips}
              showWarnings={simulationConfig.showSecurityWarnings}
            />
          )}

          {/* Education Panel */}
          {showEducation && (
            <EducationPanel
              device={selectedDevice}
              transaction={transaction}
              currentStep={currentStepData}
            />
          )}

          {/* Transaction Summary */}
          <TransactionSummary
            transaction={transaction}
            erc7730Spec={erc7730Spec}
          />
        </div>
      </div>
    </div>
  );
};

// Component implementations

const DeviceSelection: React.FC<{
  devices: DeviceType[];
  selectedDevice: DeviceType;
  onSelectDevice: (device: DeviceType) => void;
}> = ({ devices, selectedDevice, onSelectDevice }) => (
  <div className="mb-6">
    <h3 className="text-lg font-semibold mb-3">Select Hardware Device</h3>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {devices.map(device => (
        <button
          key={device.id}
          onClick={() => onSelectDevice(device)}
          className={`p-3 border rounded-lg text-center hover:border-blue-500 ${
            selectedDevice.id === device.id
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200'
          }`}
        >
          <div className="font-medium">{device.name}</div>
          <div className="text-sm text-gray-500">
            {device.screenSize.width}×{device.screenSize.height}
          </div>
          <div className="text-xs text-gray-400">
            {device.hasTouch ? 'Touch' : `${device.buttonCount} Buttons`}
          </div>
        </button>
      ))}
    </div>
  </div>
);

const ProgressIndicator: React.FC<{
  steps: SigningStep[];
  currentStep: number;
  completedSteps: Record<string, boolean>;
}> = ({ steps, currentStep, completedSteps }) => (
  <div className="mb-6">
    <div className="flex items-center justify-between">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              index === currentStep
                ? 'bg-blue-600 text-white'
                : completedSteps[step.id]
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            {completedSteps[step.id] ? '✓' : index + 1}
          </div>
          {index < steps.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-2 ${
                completedSteps[step.id] ? 'bg-green-500' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
    <div className="mt-2 text-center">
      <span className="text-sm text-gray-600">
        Step {currentStep + 1} of {steps.length}: {steps[currentStep]?.title}
      </span>
    </div>
  </div>
);

const DeviceDisplay: React.FC<{
  device: DeviceType;
  step: SigningStep;
  onUserAction: () => void;
  config: SimulationConfig;
}> = ({ device, step, onUserAction, config }) => {
  const [isInteracting, setIsInteracting] = useState(false);

  const handleUserAction = () => {
    setIsInteracting(true);
    setTimeout(() => {
      setIsInteracting(false);
      onUserAction();
    }, 500);
  };

  return (
    <div className="bg-gray-900 p-6 rounded-lg">
      <div className="text-center mb-4">
        <h3 className="text-white text-lg font-semibold">{device.name}</h3>
      </div>
      
      {/* Device Frame */}
      <div
        className={`mx-auto bg-black rounded-lg p-4 relative ${
          device.displayType === 'e-ink' ? 'bg-gray-100' : 'bg-black'
        }`}
        style={{
          width: Math.min(device.screenSize.width / 2, 400),
          height: Math.min(device.screenSize.height / 2, 600)
        }}
      >
        {/* Screen Content */}
        <div
          className={`w-full h-full flex items-center justify-center ${
            device.displayType === 'e-ink' ? 'text-black' : 'text-white'
          }`}
        >
          {step.screen}
        </div>

        {/* Touch Interaction Overlay */}
        {device.hasTouch && (
          <div
            className="absolute inset-0 cursor-pointer"
            onClick={handleUserAction}
          />
        )}
      </div>

      {/* Device Controls */}
      {!device.hasTouch && (
        <div className="flex justify-center mt-4 space-x-4">
          {Array.from({ length: device.buttonCount }, (_, i) => (
            <button
              key={i}
              onClick={handleUserAction}
              className={`w-12 h-6 bg-gray-600 rounded-full transition-colors ${
                isInteracting ? 'bg-blue-500' : 'hover:bg-gray-500'
              }`}
            />
          ))}
        </div>
      )}

      {/* Action Instructions */}
      <div className="text-center mt-4 text-gray-300">
        {getActionInstruction(step.userAction, device)}
      </div>
    </div>
  );
};

const StepInformation: React.FC<{
  step: SigningStep;
  showTips: boolean;
  showWarnings: boolean;
}> = ({ step, showTips, showWarnings }) => (
  <div className="bg-gray-50 p-4 rounded-lg">
    <h4 className="font-semibold mb-2">{step.title}</h4>
    <p className="text-gray-600 mb-3">{step.description}</p>
    
    {showWarnings && step.warnings && step.warnings.length > 0 && (
      <div className="mb-3">
        <h5 className="font-medium text-red-600 mb-1">⚠️ Security Warnings</h5>
        <ul className="text-sm text-red-600 space-y-1">
          {step.warnings.map((warning, index) => (
            <li key={index}>• {warning}</li>
          ))}
        </ul>
      </div>
    )}

    {showTips && step.tips && step.tips.length > 0 && (
      <div>
        <h5 className="font-medium text-blue-600 mb-1">💡 Tips</h5>
        <ul className="text-sm text-blue-600 space-y-1">
          {step.tips.map((tip, index) => (
            <li key={index}>• {tip}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

// Screen Components for different steps
const ConnectionScreen: React.FC<{ device: DeviceType }> = ({ device }) => (
  <div className="text-center">
    <div className="text-2xl mb-2">🔗</div>
    <div className="text-sm">Connected</div>
    <div className="text-xs opacity-70">{device.name}</div>
  </div>
);

const AppSelectionScreen: React.FC<{ device: DeviceType }> = ({ device }) => (
  <div className="text-center">
    <div className="text-2xl mb-2">⟠</div>
    <div className="text-sm">Ethereum App</div>
    <div className="text-xs opacity-70">Ready</div>
  </div>
);

const TransactionReviewScreen: React.FC<{
  device: DeviceType;
  transaction: Transaction;
  spec: any;
}> = ({ device, transaction, spec }) => (
  <div className="text-xs space-y-1">
    <div>To: {transaction.to.slice(0, 8)}...</div>
    <div>Amount: {transaction.value} ETH</div>
    <div>Gas: {transaction.gasLimit}</div>
    {spec?.intent && <div>Action: {spec.intent}</div>}
  </div>
);

const SecurityWarningScreen: React.FC<{
  device: DeviceType;
  risks: string[];
}> = ({ device, risks }) => (
  <div className="text-center">
    <div className="text-xl mb-2">⚠️</div>
    <div className="text-xs">Security Warning</div>
    <div className="text-xs opacity-70">Review carefully</div>
  </div>
);

const ConfirmationScreen: React.FC<{ device: DeviceType }> = ({ device }) => (
  <div className="text-center">
    <div className="text-xl mb-2">✓</div>
    <div className="text-sm">Confirm</div>
    <div className="text-xs opacity-70">
      {device.hasTouch ? 'Hold to sign' : 'Press both buttons'}
    </div>
  </div>
);

const EducationPanel: React.FC<{
  device: DeviceType;
  transaction: Transaction;
  currentStep?: SigningStep;
}> = ({ device, transaction, currentStep }) => (
  <div className="bg-purple-50 p-4 rounded-lg">
    <h4 className="font-semibold text-purple-800 mb-2">🎓 Learn More</h4>
    <div className="text-sm text-purple-700 space-y-2">
      <p>Hardware wallets provide the highest security for cryptocurrency transactions.</p>
      <p>Your private keys never leave the device, ensuring maximum protection.</p>
      {currentStep && (
        <p><strong>Current Step:</strong> {getEducationalContent(currentStep.id)}</p>
      )}
    </div>
  </div>
);

const TransactionSummary: React.FC<{
  transaction: Transaction;
  erc7730Spec: any;
}> = ({ transaction, erc7730Spec }) => (
  <div className="bg-blue-50 p-4 rounded-lg">
    <h4 className="font-semibold text-blue-800 mb-2">Transaction Summary</h4>
    <div className="text-sm text-blue-700 space-y-1">
      <div><strong>To:</strong> {transaction.to}</div>
      <div><strong>Value:</strong> {transaction.value} ETH</div>
      <div><strong>Gas Limit:</strong> {transaction.gasLimit}</div>
      <div><strong>Chain ID:</strong> {transaction.chainId}</div>
      {erc7730Spec?.intent && (
        <div><strong>Action:</strong> {erc7730Spec.intent}</div>
      )}
    </div>
  </div>
);

// Helper functions
const getActionInstruction = (action: SigningStep['userAction'], device: DeviceType): string => {
  switch (action) {
    case 'tap':
      return 'Tap the screen to continue';
    case 'swipe':
      return 'Swipe to navigate';
    case 'button-press':
      return device.buttonCount === 2 ? 'Press both buttons' : 'Press the button';
    case 'hold':
      return 'Hold to confirm';
    case 'review':
      return 'Review the information carefully';
    default:
      return 'Follow the on-screen instructions';
  }
};

const hasSecurityRisks = (transaction: Transaction): boolean => {
  // Simple risk assessment
  return parseFloat(transaction.value) > 1 || transaction.data.length > 10;
};

const getSecurityRisks = (transaction: Transaction): string[] => {
  const risks = [];
  if (parseFloat(transaction.value) > 1) {
    risks.push('High value transaction detected');
  }
  if (transaction.data.length > 10) {
    risks.push('Complex contract interaction');
  }
  return risks;
};

const getEducationalContent = (stepId: string): string => {
  const content = {
    connect: 'This step verifies your hardware wallet is properly connected and authenticated.',
    app: 'Opening the correct application ensures you can interact with the right blockchain.',
    review: 'This is the most critical step - verify all transaction details are correct.',
    security: 'Security warnings help you identify potential risks before signing.',
    confirm: 'Final confirmation commits the transaction to the blockchain - this cannot be undone.'
  };
  return content[stepId as keyof typeof content] || 'Learn about hardware wallet security.';
};

// Helper functions
const calculateTransactionCost = (transaction: Transaction): string => {
  const gasPrice = parseInt(transaction.gasPrice);
  const gasLimit = parseInt(transaction.gasLimit);
  const costInWei = gasPrice * gasLimit;
  const costInEth = costInWei / 1e18;
  return `$${(costInEth * 2000).toFixed(2)}`; // Assuming ETH = $2000
};

export default EnhancedDeviceSimulator;