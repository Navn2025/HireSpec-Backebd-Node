import axios from 'axios';

class GroqAIService
{
    constructor()
    {
        this.apiKey=process.env.GROQ_API_KEY;
        if (this.apiKey)
        {
            console.log('✅ Groq AI initialized');
        } else
        {
            console.warn('⚠️ GROQ_API_KEY not found in environment variables');
        }
    }

    /**
     * Generate embedding vector
     * Note: Groq does not provide embeddings API, return null
     * @param {string} text
     * @returns {Array<number>|null}
     */
    async generateEmbedding(text)
    {
        // Groq does not support embeddings - return null
        // Embeddings will be skipped in the chat flow
        console.log('ℹ️ Embeddings not supported with Groq, skipping');
        return null;
    }

    /**
     * Generate AI response for conversation
     * @param {Array} messages - Array of {role, content}
     * @param {string} systemPrompt - System instruction
     * @returns {string|null}
     */
    async generateResponse(messages, systemPrompt='You are a helpful AI assistant.')
    {
        try
        {
            if (!this.apiKey)
            {
                return "I'm sorry, I'm not available right now. Please try again later.";
            }

            // Build messages array for Groq
            const groqMessages=[
                {role: 'system', content: systemPrompt},
                ...messages.map(msg => ({
                    role: msg.role==='user'? 'user':'assistant',
                    content: msg.content
                }))
            ];

            const completion=await axios.post(
                'https://api.groq.com/openai/v1/chat/completions',
                {
                    messages: groqMessages,
                    model: 'llama-3.3-70b-versatile',
                    temperature: 0.7,
                    max_tokens: 1500,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                }
            );

            const response=completion.data.choices[0]?.message?.content;
            if (response)
            {
                return response;
            }

            return "I couldn't generate a response. Please try again.";

        } catch (error)
        {
            // Check if it's rate limit error
            if (error.response?.status===429)
            {
                console.warn('⚠️ Groq rate limit exceeded');
                return "I'm currently experiencing high demand. Please try again in a few moments.";
            }
            console.error('Groq AI Error:', error.response?.data||error.message);
            return "I encountered an error processing your request. Please try again.";
        }
    }
}

export default new GroqAIService();


