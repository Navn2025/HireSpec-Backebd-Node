import express from 'express';

const router=express.Router();

// In-memory chat storage (no database)
const chats=new Map();
const messages=new Map();

// Create a new chat
router.post('/chats', (req, res) =>
{
    try
    {
        const {title='New Chat', userId='anonymous'}=req.body;

        const chatId=`chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const chat={
            id: chatId,
            title,
            userId,
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString()
        };

        chats.set(chatId, chat);
        messages.set(chatId, []);

        res.json({
            success: true,
            message: 'Chat created successfully',
            chat
        });
    } catch (error)
    {
        console.error('Create chat error:', error);
        res.status(500).json({error: 'Failed to create chat'});
    }
});

// Get all chats for a user
router.get('/chats', (req, res) =>
{
    try
    {
        const {userId='anonymous'}=req.query;

        const userChats=Array.from(chats.values())
            .filter(chat => chat.userId===userId)
            .sort((a, b) => new Date(b.lastActivity)-new Date(a.lastActivity));

        res.json({
            success: true,
            chats: userChats
        });
    } catch (error)
    {
        console.error('Get chats error:', error);
        res.status(500).json({error: 'Failed to get chats'});
    }
});

// Get messages for a chat
router.get('/chats/:chatId/messages', (req, res) =>
{
    try
    {
        const {chatId}=req.params;

        if (!chats.has(chatId))
        {
            return res.status(404).json({error: 'Chat not found'});
        }

        const chatMessages=messages.get(chatId)||[];

        res.json({
            success: true,
            messages: chatMessages
        });
    } catch (error)
    {
        console.error('Get messages error:', error);
        res.status(500).json({error: 'Failed to get messages'});
    }
});

// Delete a chat
router.delete('/chats/:chatId', (req, res) =>
{
    try
    {
        const {chatId}=req.params;

        if (!chats.has(chatId))
        {
            return res.status(404).json({error: 'Chat not found'});
        }

        chats.delete(chatId);
        messages.delete(chatId);

        res.json({
            success: true,
            message: 'Chat deleted successfully'
        });
    } catch (error)
    {
        console.error('Delete chat error:', error);
        res.status(500).json({error: 'Failed to delete chat'});
    }
});

// Export for internal use
export function addMessage(chatId, message)
{
    if (!messages.has(chatId))
    {
        messages.set(chatId, []);
    }

    const chatMessages=messages.get(chatId);
    chatMessages.push({
        ...message,
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString()
    });

    // Update last activity
    if (chats.has(chatId))
    {
        const chat=chats.get(chatId);
        chat.lastActivity=new Date().toISOString();
    }

    return chatMessages[chatMessages.length-1];
}

export function getChatMessages(chatId)
{
    return messages.get(chatId)||[];
}

export default router;
