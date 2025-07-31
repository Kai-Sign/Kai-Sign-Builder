/**
 * Advanced AI-powered intent generation for ERC7730 specifications
 * Generates human-readable descriptions using context-aware AI
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface Parameter {
  name: string;
  type: string;
  indexed?: boolean;
  components?: Parameter[];
}

export interface ContractContext {
  contractName?: string;
  contractAddress: string;
  chainId: number;
  protocol?: string;
  category?: 'defi' | 'nft' | 'gaming' | 'dao' | 'utility' | 'bridge';
  description?: string;
}

export interface GeneratedIntent {
  primaryIntent: string;
  detailedDescription: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  userFriendlyExplanation: string;
  potentialRisks: string[];
  requiredApprovals?: string[];
  estimatedGasCost?: string;
  alternatives?: string[];
  securityScore: number;
  clarityScore: number;
  intentConfidence: number;
  contextualWarnings?: ContextualWarning[];
  educationalContent?: EducationalContent;
  crossChainImplications?: CrossChainImplication[];
}

export interface ContextualWarning {
  type: 'security' | 'financial' | 'irreversible' | 'privacy';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  mitigation?: string;
}

export interface EducationalContent {
  concepts: ConceptExplanation[];
  bestPractices: string[];
  commonMistakes: string[];
  relatedResources: Resource[];
}

export interface ConceptExplanation {
  term: string;
  definition: string;
  example?: string;
}

export interface Resource {
  title: string;
  url: string;
  type: 'article' | 'video' | 'documentation';
}

export interface CrossChainImplication {
  chainId: number;
  chainName: string;
  impact: string;
  considerations: string[];
}

export interface FieldFormat {
  path: string;
  label: string;
  format: 'raw' | 'amount' | 'address' | 'date' | 'percentage' | 'token' | 'duration';
  description?: string;
  unit?: string;
}

export class IntentGenerator {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private intentCache: Map<string, GeneratedIntent> = new Map();
  private contextAnalyzer: ContextAnalyzer;
  private securityScorer: SecurityScorer;
  private educationEngine: EducationEngine;
  private crossChainAnalyzer: CrossChainAnalyzer;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GOOGLE_GENAI_API_KEY;
    if (!key) {
      throw new Error('Google GenAI API key is required');
    }
    this.genAI = new GoogleGenerativeAI(key);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    // Initialize advanced components
    this.contextAnalyzer = new ContextAnalyzer();
    this.securityScorer = new SecurityScorer();
    this.educationEngine = new EducationEngine();
    this.crossChainAnalyzer = new CrossChainAnalyzer();
  }

  /**
   * Generate human-readable intent for a smart contract function
   */
  async generateHumanReadableIntent(
    functionName: string,
    parameters: Parameter[],
    context: ContractContext,
    additionalContext?: {
      functionDescription?: string;
      commonUseCases?: string[];
      relatedFunctions?: string[];
      userProfile?: UserProfile;
      transactionHistory?: TransactionHistoryItem[];
    }
  ): Promise<GeneratedIntent> {
    // Check cache first
    const cacheKey = this.generateCacheKey(functionName, parameters, context);
    if (this.intentCache.has(cacheKey)) {
      return this.intentCache.get(cacheKey)!;
    }

    try {
      // Generate base intent
      const prompt = this.buildEnhancedIntentPrompt(functionName, parameters, context, additionalContext);
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      
      let intent = await this.parseEnhancedIntentResponse(response, functionName, parameters, context);
      
      // Enhance with additional analysis
      intent = await this.enhanceWithSecurityAnalysis(intent, functionName, parameters, context);
      intent = await this.enhanceWithEducationalContent(intent, functionName, parameters, context);
      intent = await this.enhanceWithCrossChainAnalysis(intent, context);
      
      // Personalize based on user profile
      if (additionalContext?.userProfile) {
        intent = await this.personalizeIntent(intent, additionalContext.userProfile);
      }
      
      // Cache the result
      this.intentCache.set(cacheKey, intent);
      
      return intent;
    } catch (error) {
      console.error('Intent generation failed:', error);
      // Enhanced fallback generation
      return this.generateEnhancedFallbackIntent(functionName, parameters, context);
    }
  }

  /**
   * Generate smart field formats with auto-detection
   */
  async generateSmartFieldFormats(
    functionName: string,
    parameters: Parameter[],
    context: ContractContext
  ): Promise<FieldFormat[]> {
    const fieldFormats: FieldFormat[] = [];

    for (const param of parameters) {
      const format = await this.detectFieldFormat(param, functionName, context);
      fieldFormats.push(format);
    }

    return fieldFormats;
  }

  /**
   * Generate multi-language intents
   */
  async generateMultiLanguageIntent(
    intent: GeneratedIntent,
    targetLanguages: string[]
  ): Promise<Record<string, GeneratedIntent>> {
    const translations: Record<string, GeneratedIntent> = {};

    for (const language of targetLanguages) {
      try {
        const translatedIntent = await this.translateIntent(intent, language);
        translations[language] = translatedIntent;
      } catch (error) {
        console.error(`Translation to ${language} failed:`, error);
        // Use original intent as fallback
        translations[language] = intent;
      }
    }

    return translations;
  }

  /**
   * Generate context-aware warnings based on function analysis
   */
  async generateContextualWarnings(
    functionName: string,
    parameters: Parameter[],
    context: ContractContext
  ): Promise<ContextualWarning[]> {
    const warnings: ContextualWarning[] = [];
    
    // Analyze function for various warning types
    const securityWarnings = await this.contextAnalyzer.analyzeSecurityContext(
      functionName, parameters, context
    );
    warnings.push(...securityWarnings);
    
    // Check for financial implications
    if (this.hasFinancialImplications(functionName, parameters)) {
      const financialWarnings = await this.analyzeFinancialRisks(
        functionName, parameters, context
      );
      warnings.push(...financialWarnings);
    }
    
    // Check for irreversible actions
    if (this.isIrreversibleAction(functionName)) {
      warnings.push({
        type: 'irreversible',
        severity: 'high',
        message: 'This action cannot be undone once confirmed',
        mitigation: 'Double-check all parameters before proceeding'
      });
    }
    
    return warnings;
  }

  /**
   * Generate visual intent representation
   */
  async generateVisualIntent(
    intent: GeneratedIntent,
    format: 'diagram' | 'flowchart' | 'infographic'
  ): Promise<VisualIntent> {
    const visualData = {
      nodes: this.extractIntentNodes(intent),
      edges: this.extractIntentEdges(intent),
      style: this.getVisualStyle(format)
    };
    
    return {
      format,
      data: visualData,
      renderInstructions: this.getVisualRenderInstructions(format)
    };
  }

  /**
   * Analyze function complexity and suggest simplifications
   */
  async analyzeComplexity(
    functionName: string,
    parameters: Parameter[],
    context: ContractContext
  ): Promise<{
    complexityScore: number;
    complexityFactors: string[];
    simplificationSuggestions: string[];
    userGuidance: string[];
    visualComplexity: VisualComplexity;
    alternativeApproaches: AlternativeApproach[];
  }> {
    let complexityScore = 0;
    const complexityFactors: string[] = [];
    const simplificationSuggestions: string[] = [];
    const userGuidance: string[] = [];

    // Analyze parameter complexity
    parameters.forEach(param => {
      if (param.type.includes('[]')) {
        complexityScore += 2;
        complexityFactors.push(`Array parameter: ${param.name}`);
        userGuidance.push(`The ${param.name} parameter accepts multiple values`);
      }

      if (param.components && param.components.length > 0) {
        complexityScore += param.components.length;
        complexityFactors.push(`Struct parameter: ${param.name} with ${param.components.length} fields`);
        userGuidance.push(`The ${param.name} parameter contains multiple sub-fields`);
      }

      if (param.type === 'bytes' || param.type.startsWith('bytes')) {
        complexityScore += 1;
        complexityFactors.push(`Raw bytes parameter: ${param.name}`);
        userGuidance.push(`The ${param.name} parameter contains encoded data`);
      }
    });

    // Function name complexity
    if (functionName.includes('batch') || functionName.includes('multi')) {
      complexityScore += 3;
      complexityFactors.push('Batch operation function');
      userGuidance.push('This function performs multiple operations at once');
    }

    // Generate suggestions based on complexity
    if (complexityScore > 5) {
      simplificationSuggestions.push('Consider breaking this into multiple simpler transactions');
      simplificationSuggestions.push('Provide clear documentation for each parameter');
      simplificationSuggestions.push('Add parameter validation and error messages');
    }

    // Generate visual complexity representation
    const visualComplexity = this.generateVisualComplexity(
      complexityScore, parameters
    );
    
    // Find alternative approaches
    const alternativeApproaches = await this.findAlternativeApproaches(
      functionName, parameters, context
    );
    
    return {
      complexityScore,
      complexityFactors,
      simplificationSuggestions,
      userGuidance,
      visualComplexity,
      alternativeApproaches
    };
  }

  private buildEnhancedIntentPrompt(
    functionName: string,
    parameters: Parameter[],
    context: ContractContext,
    additionalContext?: any
  ): string {
    const parametersStr = this.formatParametersWithTypes(parameters);
    const contextStr = this.buildEnhancedContextString(context);
    const userContext = additionalContext?.userProfile ? 
      `User Experience Level: ${additionalContext.userProfile.experienceLevel}\n` : '';
    
    return `
You are an expert in blockchain technology, smart contracts, and user experience design. 
Generate a comprehensive, clear, and educational intent description for a smart contract function.

Function: ${functionName}(${parametersStr})
Contract Context: ${contextStr}
${userContext}
${additionalContext?.functionDescription ? `Function Description: ${additionalContext.functionDescription}` : ''}
${additionalContext?.commonUseCases ? `Common Use Cases: ${additionalContext.commonUseCases.join(', ')}` : ''}

Please provide a JSON response with the following enhanced structure:
{
  "primaryIntent": "Brief, clear description of what this function does",
  "detailedDescription": "Comprehensive explanation including all parameters, their purposes, and the function's effects",
  "riskLevel": "low|medium|high|critical",
  "userFriendlyExplanation": "Explanation in simple terms that any user can understand, avoiding technical jargon",
  "potentialRisks": ["Array of specific risks with clear explanations"],
  "requiredApprovals": ["Array of what the user is approving or allowing"],
  "estimatedGasCost": "Detailed gas cost estimate with factors affecting it",
  "alternatives": ["Array of alternative approaches with pros and cons"],
  "securityScore": 0-100,
  "clarityScore": 0-100,
  "intentConfidence": 0-100,
  "contextualWarnings": [
    {
      "type": "security|financial|irreversible|privacy",
      "severity": "low|medium|high|critical",
      "message": "Clear warning message",
      "mitigation": "How to address this warning"
    }
  ],
  "educationalContent": {
    "concepts": [
      {"term": "Technical term", "definition": "Clear explanation", "example": "Optional example"}
    ],
    "bestPractices": ["Best practices for this type of transaction"],
    "commonMistakes": ["Common mistakes to avoid"]
  },
  "crossChainImplications": [
    {
      "chainId": 1,
      "chainName": "Ethereum",
      "impact": "How this affects other chains",
      "considerations": ["Things to consider"]
    }
  ]
}

Guidelines:
- Prioritize user safety and understanding
- Be specific about risks and their likelihood
- Provide actionable guidance
- Consider the user's experience level
- Include relevant educational content
- Explain technical concepts in accessible terms
- Consider cross-chain implications if applicable
`;
  }

  private buildIntentPrompt(
    functionName: string,
    parameters: Parameter[],
    context: ContractContext,
    additionalContext?: any
  ): string {
    const parametersStr = parameters.map(p => `${p.name}: ${p.type}`).join(', ');
    const contextStr = this.buildContextString(context);
    
    return `
You are an expert in blockchain technology and smart contracts. Generate a clear, human-readable intent description for a smart contract function.

Function: ${functionName}(${parametersStr})
Contract Context: ${contextStr}
${additionalContext?.functionDescription ? `Function Description: ${additionalContext.functionDescription}` : ''}
${additionalContext?.commonUseCases ? `Common Use Cases: ${additionalContext.commonUseCases.join(', ')}` : ''}

Please provide a JSON response with the following structure:
{
  "primaryIntent": "Brief, clear description of what this function does",
  "detailedDescription": "Detailed explanation including all parameters and their purposes",
  "riskLevel": "low|medium|high",
  "userFriendlyExplanation": "Explanation in simple terms that any user can understand",
  "potentialRisks": ["Array of potential risks or things users should be aware of"],
  "requiredApprovals": ["Array of what the user is approving or allowing"],
  "estimatedGasCost": "Rough estimate of gas cost (low/medium/high)",
  "alternatives": ["Array of alternative approaches or related functions"]
}

Guidelines:
- Use clear, non-technical language
- Explain the purpose and impact of the function
- Highlight any risks or important considerations
- Be concise but informative
- Consider the contract context (DeFi, NFT, etc.)
- Explain what permissions or approvals are being granted
`;
  }

  private buildContextString(context: ContractContext): string {
    let contextStr = `Contract Address: ${context.contractAddress}, Chain ID: ${context.chainId}`;
    
    if (context.contractName) contextStr += `, Name: ${context.contractName}`;
    if (context.protocol) contextStr += `, Protocol: ${context.protocol}`;
    if (context.category) contextStr += `, Category: ${context.category}`;
    if (context.description) contextStr += `, Description: ${context.description}`;

    return contextStr;
  }

  private async parseEnhancedIntentResponse(
    response: string,
    functionName: string,
    parameters: Parameter[],
    context: ContractContext
  ): Promise<GeneratedIntent> {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          primaryIntent: parsed.primaryIntent || this.generateBasicIntent(functionName),
          detailedDescription: parsed.detailedDescription || 'No detailed description available',
          riskLevel: parsed.riskLevel || 'medium',
          userFriendlyExplanation: parsed.userFriendlyExplanation || parsed.primaryIntent,
          potentialRisks: Array.isArray(parsed.potentialRisks) ? parsed.potentialRisks : [],
          requiredApprovals: Array.isArray(parsed.requiredApprovals) ? parsed.requiredApprovals : [],
          estimatedGasCost: parsed.estimatedGasCost || 'medium',
          alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives : [],
          securityScore: parsed.securityScore || 50,
          clarityScore: parsed.clarityScore || 50,
          intentConfidence: parsed.intentConfidence || 75,
          contextualWarnings: Array.isArray(parsed.contextualWarnings) ? parsed.contextualWarnings : [],
          educationalContent: parsed.educationalContent || undefined,
          crossChainImplications: Array.isArray(parsed.crossChainImplications) ? 
            parsed.crossChainImplications : undefined
        };
      }
    } catch (error) {
      console.error('Failed to parse enhanced AI response:', error);
    }

    // Fallback to enhanced rule-based generation
    return this.generateEnhancedFallbackIntent(functionName, parameters, context);
  }

  private async parseIntentResponse(
    response: string,
    functionName: string,
    parameters: Parameter[],
    context: ContractContext
  ): Promise<GeneratedIntent> {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          primaryIntent: parsed.primaryIntent || this.generateBasicIntent(functionName),
          detailedDescription: parsed.detailedDescription || 'No detailed description available',
          riskLevel: parsed.riskLevel || 'medium',
          userFriendlyExplanation: parsed.userFriendlyExplanation || parsed.primaryIntent,
          potentialRisks: Array.isArray(parsed.potentialRisks) ? parsed.potentialRisks : [],
          requiredApprovals: Array.isArray(parsed.requiredApprovals) ? parsed.requiredApprovals : [],
          estimatedGasCost: parsed.estimatedGasCost || 'medium',
          alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives : []
        };
      }
    } catch (error) {
      console.error('Failed to parse AI response:', error);
    }

    // Fallback to rule-based generation
    return this.generateFallbackIntent(functionName, parameters, context);
  }

  private generateEnhancedFallbackIntent(
    functionName: string,
    parameters: Parameter[],
    context: ContractContext
  ): GeneratedIntent {
    const basicIntent = this.generateBasicIntent(functionName);
    const riskLevel = this.assessEnhancedRiskLevel(functionName, parameters, context);
    const securityScore = this.calculateSecurityScore(functionName, parameters, context);
    
    return {
      primaryIntent: basicIntent,
      detailedDescription: `Calls the ${functionName} function with ${parameters.length} parameters`,
      riskLevel,
      userFriendlyExplanation: basicIntent,
      potentialRisks: this.identifyEnhancedRisks(functionName, parameters, context),
      requiredApprovals: this.identifyApprovals(functionName, parameters),
      estimatedGasCost: this.estimateGasCost(functionName, parameters),
      alternatives: this.suggestAlternatives(functionName, context),
      securityScore,
      clarityScore: this.calculateClarityScore(functionName, parameters),
      intentConfidence: 60, // Lower confidence for fallback
      contextualWarnings: this.generateBasicWarnings(functionName, parameters, context),
      educationalContent: this.generateBasicEducationalContent(functionName, context)
    };
  }

  private generateFallbackIntent(
    functionName: string,
    parameters: Parameter[],
    context: ContractContext
  ): GeneratedIntent {
    const basicIntent = this.generateBasicIntent(functionName);
    const riskLevel = this.assessRiskLevel(functionName, parameters);
    
    return {
      primaryIntent: basicIntent,
      detailedDescription: `Calls the ${functionName} function with ${parameters.length} parameters`,
      riskLevel,
      userFriendlyExplanation: basicIntent,
      potentialRisks: this.identifyBasicRisks(functionName, parameters),
      requiredApprovals: this.identifyApprovals(functionName, parameters),
      estimatedGasCost: this.estimateGasCost(functionName, parameters),
      alternatives: []
    };
  }

  private generateBasicIntent(functionName: string): string {
    // Rule-based intent generation based on common function patterns
    const lowerName = functionName.toLowerCase();
    
    if (lowerName.includes('transfer')) return 'Transfer tokens or assets';
    if (lowerName.includes('approve')) return 'Approve spending or access';
    if (lowerName.includes('swap')) return 'Exchange one token for another';
    if (lowerName.includes('deposit')) return 'Deposit funds into the contract';
    if (lowerName.includes('withdraw')) return 'Withdraw funds from the contract';
    if (lowerName.includes('stake')) return 'Stake tokens for rewards';
    if (lowerName.includes('unstake')) return 'Unstake tokens and claim rewards';
    if (lowerName.includes('mint')) return 'Create new tokens or NFTs';
    if (lowerName.includes('burn')) return 'Destroy tokens permanently';
    if (lowerName.includes('claim')) return 'Claim rewards or tokens';
    if (lowerName.includes('vote')) return 'Cast a vote in governance';
    if (lowerName.includes('delegate')) return 'Delegate voting power';
    if (lowerName.includes('propose')) return 'Create a governance proposal';
    if (lowerName.includes('execute')) return 'Execute a transaction or proposal';
    if (lowerName.includes('pause')) return 'Pause contract functionality';
    if (lowerName.includes('unpause')) return 'Resume contract functionality';
    
    return `Execute ${functionName} function`;
  }

  private assessEnhancedRiskLevel(
    functionName: string, 
    parameters: Parameter[],
    context: ContractContext
  ): 'low' | 'medium' | 'high' | 'critical' {
    const lowerName = functionName.toLowerCase();
    const hasValueTransfer = parameters.some(p => 
      p.name.toLowerCase().includes('amount') || 
      p.name.toLowerCase().includes('value')
    );
    
    // Critical risk functions
    if (lowerName.includes('selfdestruct') || lowerName.includes('suicide')) return 'critical';
    if (lowerName.includes('upgradeto') && context.contractName?.includes('Proxy')) return 'critical';
    if (lowerName.includes('setowner') || lowerName.includes('transferownership')) return 'critical';
    
    // High risk functions
    if (lowerName.includes('transfer') && hasValueTransfer) return 'high';
    if (lowerName.includes('withdraw') && hasValueTransfer) return 'high';
    if (lowerName.includes('approve') && hasValueTransfer) return 'high';
    if (lowerName.includes('delegate')) return 'high';
    if (lowerName.includes('admin') || lowerName.includes('owner')) return 'high';
    if (lowerName.includes('pause') || lowerName.includes('unpause')) return 'high';

    // Medium risk functions
    if (lowerName.includes('swap')) return 'medium';
    if (lowerName.includes('stake')) return 'medium';
    if (lowerName.includes('vote')) return 'medium';
    if (hasValueTransfer) return 'medium';
    if (lowerName.includes('mint') || lowerName.includes('burn')) return 'medium';

    return 'low';
  }

  private assessRiskLevel(functionName: string, parameters: Parameter[]): 'low' | 'medium' | 'high' {
    const lowerName = functionName.toLowerCase();
    const hasValueTransfer = parameters.some(p => 
      p.name.toLowerCase().includes('amount') || 
      p.name.toLowerCase().includes('value')
    );

    // High risk functions
    if (lowerName.includes('transfer') && hasValueTransfer) return 'high';
    if (lowerName.includes('withdraw') && hasValueTransfer) return 'high';
    if (lowerName.includes('approve') && hasValueTransfer) return 'high';
    if (lowerName.includes('delegate')) return 'high';
    if (lowerName.includes('admin') || lowerName.includes('owner')) return 'high';

    // Medium risk functions
    if (lowerName.includes('swap')) return 'medium';
    if (lowerName.includes('stake')) return 'medium';
    if (lowerName.includes('vote')) return 'medium';
    if (hasValueTransfer) return 'medium';

    return 'low';
  }

  private identifyBasicRisks(functionName: string, parameters: Parameter[]): string[] {
    const risks: string[] = [];
    const lowerName = functionName.toLowerCase();

    if (lowerName.includes('approve')) {
      risks.push('Granting spending permissions to another address');
    }
    if (lowerName.includes('transfer')) {
      risks.push('Irreversible token transfer');
    }
    if (lowerName.includes('delegate')) {
      risks.push('Delegating voting power or authority');
    }
    if (parameters.some(p => p.name.toLowerCase().includes('recipient'))) {
      risks.push('Verify recipient address carefully');
    }
    if (parameters.some(p => p.type === 'bytes' || p.type.startsWith('bytes'))) {
      risks.push('Contains encoded data that may have additional effects');
    }

    return risks;
  }

  private identifyApprovals(functionName: string, parameters: Parameter[]): string[] {
    const approvals: string[] = [];
    const lowerName = functionName.toLowerCase();

    if (lowerName.includes('approve')) {
      approvals.push('Token spending approval');
    }
    if (lowerName.includes('transfer')) {
      approvals.push('Token transfer authorization');
    }
    if (lowerName.includes('stake')) {
      approvals.push('Token staking authorization');
    }
    if (lowerName.includes('swap')) {
      approvals.push('Token exchange authorization');
    }

    return approvals;
  }

  private estimateGasCost(functionName: string, parameters: Parameter[]): string {
    const lowerName = functionName.toLowerCase();
    const paramCount = parameters.length;

    // High gas functions
    if (lowerName.includes('batch') || lowerName.includes('multi')) return 'high';
    if (lowerName.includes('deploy') || lowerName.includes('create')) return 'high';
    if (paramCount > 5) return 'high';

    // Medium gas functions
    if (lowerName.includes('swap') || lowerName.includes('exchange')) return 'medium';
    if (lowerName.includes('stake') || lowerName.includes('unstake')) return 'medium';
    if (paramCount > 2) return 'medium';

    return 'low';
  }

  private async detectFieldFormat(
    parameter: Parameter,
    functionName: string,
    context: ContractContext
  ): Promise<FieldFormat> {
    const paramName = parameter.name.toLowerCase();
    const paramType = parameter.type.toLowerCase();

    // Auto-detect format based on parameter characteristics
    let format: FieldFormat['format'] = 'raw';
    let label = parameter.name;
    let description = '';
    let unit = '';

    // Address detection
    if (paramType === 'address') {
      format = 'address';
      if (paramName.includes('token')) {
        label = 'Token Address';
        description = 'The contract address of the token';
      } else if (paramName.includes('recipient') || paramName.includes('to')) {
        label = 'Recipient Address';
        description = 'The address that will receive the tokens';
      } else {
        label = 'Contract Address';
        description = 'The address of the smart contract';
      }
    }

    // Amount detection
    else if (paramName.includes('amount') || paramName.includes('value') || paramName.includes('balance')) {
      format = 'amount';
      label = 'Amount';
      description = 'The quantity of tokens';
      
      // Try to determine the token unit from context
      if (context.category === 'defi') {
        unit = 'tokens';
      }
    }

    // Time/Date detection
    else if (paramName.includes('timestamp') || paramName.includes('deadline') || paramName.includes('time')) {
      format = 'date';
      label = 'Timestamp';
      description = 'Date and time value';
    }

    // Duration detection
    else if (paramName.includes('duration') || paramName.includes('period') || paramName.includes('delay')) {
      format = 'duration';
      label = 'Duration';
      description = 'Time period in seconds';
      unit = 'seconds';
    }

    // Percentage detection
    else if (paramName.includes('rate') || paramName.includes('fee') || paramName.includes('percent')) {
      format = 'percentage';
      label = 'Rate/Fee';
      description = 'Percentage value';
      unit = '%';
    }

    // Token ID detection
    else if (paramName.includes('tokenid') || paramName.includes('id')) {
      format = 'raw';
      label = 'Token ID';
      description = 'Unique identifier for the token';
    }

    return {
      path: parameter.name,
      label,
      format,
      description,
      unit
    };
  }

  private async translateIntent(intent: GeneratedIntent, targetLanguage: string): Promise<GeneratedIntent> {
    const prompt = `
Translate the following smart contract function intent to ${targetLanguage}. Maintain technical accuracy while making it culturally appropriate:

Primary Intent: ${intent.primaryIntent}
Detailed Description: ${intent.detailedDescription}
User Friendly Explanation: ${intent.userFriendlyExplanation}
Potential Risks: ${intent.potentialRisks.join(', ')}
Required Approvals: ${intent.requiredApprovals?.join(', ')}

Provide the translation in the same JSON structure.
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      const translated = JSON.parse(response);
      
      return {
        ...intent,
        primaryIntent: translated.primaryIntent || intent.primaryIntent,
        detailedDescription: translated.detailedDescription || intent.detailedDescription,
        userFriendlyExplanation: translated.userFriendlyExplanation || intent.userFriendlyExplanation,
        potentialRisks: translated.potentialRisks || intent.potentialRisks,
        requiredApprovals: translated.requiredApprovals || intent.requiredApprovals
      };
    } catch (error) {
      console.error('Translation failed:', error);
      return intent; // Return original as fallback
    }
  }

  // New helper methods
  private generateCacheKey(functionName: string, parameters: Parameter[], context: ContractContext): string {
    return `${context.contractAddress}-${context.chainId}-${functionName}-${parameters.length}`;
  }

  private formatParametersWithTypes(parameters: Parameter[]): string {
    return parameters.map(p => {
      if (p.components) {
        return `${p.name}: ${p.type}(${this.formatParametersWithTypes(p.components)})`;
      }
      return `${p.name}: ${p.type}`;
    }).join(', ');
  }

  private buildEnhancedContextString(context: ContractContext): string {
    let contextStr = `Contract Address: ${context.contractAddress}, Chain ID: ${context.chainId}`;
    
    if (context.contractName) contextStr += `, Name: ${context.contractName}`;
    if (context.protocol) contextStr += `, Protocol: ${context.protocol}`;
    if (context.category) contextStr += `, Category: ${context.category}`;
    if (context.description) contextStr += `, Description: ${context.description}`;

    return contextStr;
  }

  private async enhanceWithSecurityAnalysis(
    intent: GeneratedIntent,
    functionName: string,
    parameters: Parameter[],
    context: ContractContext
  ): Promise<GeneratedIntent> {
    const securityAnalysis = await this.securityScorer.analyze(functionName, parameters, context);
    
    return {
      ...intent,
      securityScore: securityAnalysis.score,
      potentialRisks: [...intent.potentialRisks, ...securityAnalysis.risks],
      contextualWarnings: [...(intent.contextualWarnings || []), ...securityAnalysis.warnings]
    };
  }

  private async enhanceWithEducationalContent(
    intent: GeneratedIntent,
    functionName: string,
    parameters: Parameter[],
    context: ContractContext
  ): Promise<GeneratedIntent> {
    const educationalContent = await this.educationEngine.generateContent(
      functionName, parameters, context
    );
    
    return {
      ...intent,
      educationalContent
    };
  }

  private async enhanceWithCrossChainAnalysis(
    intent: GeneratedIntent,
    context: ContractContext
  ): Promise<GeneratedIntent> {
    const crossChainImplications = await this.crossChainAnalyzer.analyze(context);
    
    return {
      ...intent,
      crossChainImplications: crossChainImplications.length > 0 ? crossChainImplications : undefined
    };
  }

  private async personalizeIntent(
    intent: GeneratedIntent,
    userProfile: UserProfile
  ): Promise<GeneratedIntent> {
    // Adjust explanation based on user experience level
    if (userProfile.experienceLevel === 'beginner') {
      intent.userFriendlyExplanation = this.simplifyExplanation(intent.userFriendlyExplanation);
    } else if (userProfile.experienceLevel === 'expert') {
      intent.detailedDescription = this.addTechnicalDetails(intent.detailedDescription);
    }
    
    return intent;
  }

  private hasFinancialImplications(functionName: string, parameters: Parameter[]): boolean {
    const financialKeywords = ['transfer', 'send', 'withdraw', 'deposit', 'swap', 'trade', 'exchange'];
    return financialKeywords.some(keyword => functionName.toLowerCase().includes(keyword)) ||
           parameters.some(p => p.name.toLowerCase().includes('amount') || p.name.toLowerCase().includes('value'));
  }

  private async analyzeFinancialRisks(
    functionName: string,
    parameters: Parameter[],
    context: ContractContext
  ): Promise<ContextualWarning[]> {
    const warnings: ContextualWarning[] = [];
    
    // Add financial risk warnings
    if (parameters.some(p => p.name.toLowerCase().includes('amount'))) {
      warnings.push({
        type: 'financial',
        severity: 'high',
        message: 'This transaction involves transferring funds',
        mitigation: 'Verify the amount and recipient address carefully'
      });
    }
    
    return warnings;
  }

  private isIrreversibleAction(functionName: string): boolean {
    const irreversibleKeywords = ['transfer', 'burn', 'destroy', 'renounce', 'close', 'finalize'];
    return irreversibleKeywords.some(keyword => functionName.toLowerCase().includes(keyword));
  }

  private extractIntentNodes(intent: GeneratedIntent): any[] {
    // Extract visual nodes from intent
    return [];
  }

  private extractIntentEdges(intent: GeneratedIntent): any[] {
    // Extract visual edges from intent
    return [];
  }

  private getVisualStyle(format: string): any {
    // Get visual style configuration
    return {};
  }

  private getVisualRenderInstructions(format: string): any {
    // Get rendering instructions
    return {};
  }

  private generateVisualComplexity(score: number, parameters: Parameter[]): VisualComplexity {
    return {
      score,
      parameterCount: parameters.length,
      nestedLevel: this.calculateNestingLevel(parameters),
      visualRepresentation: 'complexity-diagram'
    };
  }

  private calculateNestingLevel(parameters: Parameter[]): number {
    let maxLevel = 0;
    for (const param of parameters) {
      if (param.components) {
        maxLevel = Math.max(maxLevel, 1 + this.calculateNestingLevel(param.components));
      }
    }
    return maxLevel;
  }

  private async findAlternativeApproaches(
    functionName: string,
    parameters: Parameter[],
    context: ContractContext
  ): Promise<AlternativeApproach[]> {
    // Find alternative approaches
    return [];
  }

  private calculateSecurityScore(
    functionName: string,
    parameters: Parameter[],
    context: ContractContext
  ): number {
    let score = 100;
    const riskLevel = this.assessEnhancedRiskLevel(functionName, parameters, context);
    
    switch (riskLevel) {
      case 'critical': score -= 50; break;
      case 'high': score -= 30; break;
      case 'medium': score -= 15; break;
      case 'low': score -= 5; break;
    }
    
    return Math.max(0, score);
  }

  private calculateClarityScore(functionName: string, parameters: Parameter[]): number {
    let score = 100;
    
    // Deduct points for complexity
    score -= parameters.length * 5;
    score -= functionName.length > 30 ? 10 : 0;
    
    // Check for clear naming
    const hasDescriptiveName = /[A-Z][a-z]+/.test(functionName);
    if (!hasDescriptiveName) score -= 10;
    
    return Math.max(0, score);
  }

  private identifyEnhancedRisks(
    functionName: string,
    parameters: Parameter[],
    context: ContractContext
  ): string[] {
    const risks = this.identifyBasicRisks(functionName, parameters);
    
    // Add context-specific risks
    if (context.category === 'defi') {
      risks.push('DeFi protocols carry inherent smart contract risks');
    }
    if (context.chainId !== 1) {
      risks.push('Cross-chain operations may have additional complexities');
    }
    
    return risks;
  }

  private suggestAlternatives(functionName: string, context: ContractContext): string[] {
    const alternatives = [];
    
    if (functionName.toLowerCase().includes('transfer')) {
      alternatives.push('Consider using transferFrom for better approval management');
    }
    if (functionName.toLowerCase().includes('swap')) {
      alternatives.push('Compare rates across different DEXs before swapping');
    }
    
    return alternatives;
  }

  private generateBasicWarnings(
    functionName: string,
    parameters: Parameter[],
    context: ContractContext
  ): ContextualWarning[] {
    const warnings: ContextualWarning[] = [];
    
    if (this.hasFinancialImplications(functionName, parameters)) {
      warnings.push({
        type: 'financial',
        severity: 'medium',
        message: 'This transaction involves financial operations',
        mitigation: 'Review all amounts and addresses'
      });
    }
    
    return warnings;
  }

  private generateBasicEducationalContent(
    functionName: string,
    context: ContractContext
  ): EducationalContent {
    return {
      concepts: [],
      bestPractices: ['Always verify transaction details before signing'],
      commonMistakes: ['Not checking gas prices before confirming'],
      relatedResources: []
    };
  }

  private simplifyExplanation(explanation: string): string {
    // Simplify for beginners
    return explanation.replace(/smart contract/gi, 'program')
                     .replace(/blockchain/gi, 'network')
                     .replace(/transaction/gi, 'action');
  }

  private addTechnicalDetails(description: string): string {
    // Add technical details for experts
    return description + ' [Technical: This involves direct interaction with contract bytecode]';
  }
}

// Helper classes
class ContextAnalyzer {
  async analyzeSecurityContext(
    functionName: string,
    parameters: Parameter[],
    context: ContractContext
  ): Promise<ContextualWarning[]> {
    return [];
  }
}

class SecurityScorer {
  async analyze(
    functionName: string,
    parameters: Parameter[],
    context: ContractContext
  ): Promise<{ score: number; risks: string[]; warnings: ContextualWarning[] }> {
    return { score: 75, risks: [], warnings: [] };
  }
}

class EducationEngine {
  async generateContent(
    functionName: string,
    parameters: Parameter[],
    context: ContractContext
  ): Promise<EducationalContent> {
    return {
      concepts: [],
      bestPractices: [],
      commonMistakes: [],
      relatedResources: []
    };
  }
}

class CrossChainAnalyzer {
  async analyze(context: ContractContext): Promise<CrossChainImplication[]> {
    return [];
  }
}

// Type definitions
interface UserProfile {
  experienceLevel: 'beginner' | 'intermediate' | 'expert';
  preferredLanguage?: string;
  riskTolerance?: 'low' | 'medium' | 'high';
}

interface TransactionHistoryItem {
  functionName: string;
  timestamp: Date;
  success: boolean;
}

interface VisualIntent {
  format: string;
  data: any;
  renderInstructions: any;
}

interface VisualComplexity {
  score: number;
  parameterCount: number;
  nestedLevel: number;
  visualRepresentation: string;
}

interface AlternativeApproach {
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  recommendedFor: string[];
}