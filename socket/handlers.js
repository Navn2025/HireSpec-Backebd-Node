import geminiAI from '../services/geminiAI.js';
import pineconeService from '../services/pineconeService.js';
import {addMessage, getChatMessages} from '../routes/axiomChat.js';

export function setupSocketHandlers(io)
{
    // Store secondary camera mappings
    const secondaryCameraMappings=new Map(); // code -> {interviewId, socketId}

    // Store proctor dashboard sockets
    const proctorDashboardSockets=new Set();

    // Store live interview sessions
    const liveInterviewRooms = new Map(); // sessionId -> { participants, codeState, screenShares }

    // Store screen share streams
    const screenShareSessions = new Map(); // sessionId -> { peerId, isSharing }

    io.on('connection', (socket) =>
    {
        console.log(`User connected: ${socket.id}`);

        // ========================================
        // Live Interview Room Handlers
        // ========================================

        // Join live interview room
        socket.on('join-live-interview', (data) => {
            const { sessionId, participantId, userName, role, cameras } = data;
            
            socket.join(`live-${sessionId}`);
            
            // Initialize room if not exists
            if (!liveInterviewRooms.has(sessionId)) {
                liveInterviewRooms.set(sessionId, {
                    participants: new Map(),
                    codeState: { code: '', language: 'javascript', cursorPositions: {} },
                    screenShares: new Map(),
                    whiteboard: [],
                    settings: { enableChat: true, enableScreenShare: true, enableCodeExecution: true }
                });
            }
            
            const room = liveInterviewRooms.get(sessionId);
            
            // Add participant
            room.participants.set(socket.id, {
                id: participantId,
                socketId: socket.id,
                userName,
                role,
                cameras: cameras || { primary: true, secondary: false },
                audioEnabled: true,
                videoEnabled: true,
                joinedAt: new Date()
            });
            
            console.log(`🎥 ${userName} (${role}) joined live interview ${sessionId}`);
            
            // Notify others in the room
            socket.to(`live-${sessionId}`).emit('participant-joined', {
                participantId,
                socketId: socket.id,
                userName,
                role,
                cameras
            });
            
            // Send current room state to new participant
            socket.emit('room-state', {
                participants: Array.from(room.participants.values()),
                codeState: room.codeState,
                screenShares: Array.from(room.screenShares.entries()),
                settings: room.settings
            });
            
            // Notify proctor dashboard
            io.to('proctor-dashboard').emit('live-session-update', {
                sessionId,
                type: 'participant-joined',
                participant: { userName, role }
            });
        });

        // Leave live interview
        socket.on('leave-live-interview', (data) => {
            const { sessionId } = data;
            handleLiveInterviewLeave(socket, sessionId);
        });

        // Dual camera status update
        socket.on('camera-status-update', (data) => {
            const { sessionId, cameraType, enabled, streamId } = data;
            
            const room = liveInterviewRooms.get(sessionId);
            if (room && room.participants.has(socket.id)) {
                const participant = room.participants.get(socket.id);
                participant.cameras[cameraType] = { enabled, streamId };
                room.participants.set(socket.id, participant);
                
                // Notify others
                socket.to(`live-${sessionId}`).emit('participant-camera-update', {
                    socketId: socket.id,
                    cameraType,
                    enabled,
                    streamId
                });
            }
        });

        // Screen share events
        socket.on('start-screen-share', (data) => {
            const { sessionId, streamType } = data; // streamType: 'screen', 'window', 'tab'
            
            const room = liveInterviewRooms.get(sessionId);
            if (room) {
                room.screenShares.set(socket.id, { 
                    streamType, 
                    startedAt: new Date() 
                });
                
                socket.to(`live-${sessionId}`).emit('screen-share-started', {
                    socketId: socket.id,
                    streamType
                });
                
                console.log(`📺 Screen share started in session ${sessionId}`);
            }
        });

        socket.on('stop-screen-share', (data) => {
            const { sessionId } = data;
            
            const room = liveInterviewRooms.get(sessionId);
            if (room) {
                room.screenShares.delete(socket.id);
                
                socket.to(`live-${sessionId}`).emit('screen-share-stopped', {
                    socketId: socket.id
                });
            }
        });

        // Live code collaboration with cursor positions
        socket.on('live-code-update', (data) => {
            const { sessionId, code, language, cursorPosition, selection } = data;
            
            const room = liveInterviewRooms.get(sessionId);
            if (room) {
                room.codeState.code = code;
                room.codeState.language = language;
                room.codeState.cursorPositions[socket.id] = { cursorPosition, selection };
                
                socket.to(`live-${sessionId}`).emit('live-code-update', {
                    code,
                    language,
                    cursorPosition,
                    selection,
                    from: socket.id
                });
            }
        });

        // Cursor position only (for showing collaborator cursors)
        socket.on('cursor-position', (data) => {
            const { sessionId, cursorPosition, selection, userName } = data;
            
            socket.to(`live-${sessionId}`).emit('cursor-position', {
                socketId: socket.id,
                cursorPosition,
                selection,
                userName
            });
        });

        // Code execution request
        socket.on('execute-code', async (data) => {
            const { sessionId, code, language, testCases } = data;
            
            // Broadcast that code is being executed
            io.to(`live-${sessionId}`).emit('code-executing', {
                by: socket.id,
                timestamp: new Date()
            });
            
            // Note: Actual execution happens via HTTP API
        });

        // Code execution result
        socket.on('code-execution-result', (data) => {
            const { sessionId, result, error, executionTime } = data;
            
            socket.to(`live-${sessionId}`).emit('code-execution-result', {
                result,
                error,
                executionTime,
                from: socket.id
            });
        });

        // Interview question selection
        socket.on('select-question', (data) => {
            const { sessionId, question, assignedTo } = data;
            
            io.to(`live-${sessionId}`).emit('question-selected', {
                question,
                assignedTo,
                by: socket.id,
                timestamp: new Date()
            });
        });

        // Timer/stopwatch controls
        socket.on('timer-control', (data) => {
            const { sessionId, action, duration } = data; // action: 'start', 'pause', 'reset', 'set'
            
            io.to(`live-${sessionId}`).emit('timer-update', {
                action,
                duration,
                by: socket.id,
                timestamp: new Date()
            });
        });

        // Drawing/whiteboard collaboration
        socket.on('whiteboard-draw', (data) => {
            const { sessionId, drawData } = data;
            
            const room = liveInterviewRooms.get(sessionId);
            if (room) {
                room.whiteboard.push(drawData);
            }
            
            socket.to(`live-${sessionId}`).emit('whiteboard-draw', {
                drawData,
                from: socket.id
            });
        });

        socket.on('whiteboard-clear', (data) => {
            const { sessionId } = data;
            
            const room = liveInterviewRooms.get(sessionId);
            if (room) {
                room.whiteboard = [];
            }
            
            io.to(`live-${sessionId}`).emit('whiteboard-cleared');
        });

        // Interview notes (recruiter only)
        socket.on('save-interview-note', (data) => {
            const { sessionId, note, timestamp } = data;
            
            // Store note - in production, save to database
            console.log(`📝 Interview note saved for session ${sessionId}`);
        });

        // Interview feedback/rating
        socket.on('interview-feedback', (data) => {
            const { sessionId, rating, feedback, technicalScore, communicationScore } = data;
            
            io.to(`live-${sessionId}`).emit('feedback-received', {
                rating,
                feedback,
                technicalScore,
                communicationScore,
                timestamp: new Date()
            });
        });

        // End interview
        socket.on('end-live-interview', (data) => {
            const { sessionId, reason } = data;
            
            io.to(`live-${sessionId}`).emit('interview-ended', {
                reason,
                endedBy: socket.id,
                timestamp: new Date()
            });
            
            // Cleanup room after a delay
            setTimeout(() => {
                liveInterviewRooms.delete(sessionId);
            }, 30000);
        });

        // ========================================
        // Enhanced WebRTC Signaling for Multiple Streams
        // ========================================

        // Multi-stream WebRTC offer (supports multiple cameras)
        socket.on('webrtc-offer-multi', (data) => {
            const { offer, to, streamType, sessionId } = data; // streamType: 'primary', 'secondary', 'screen'
            
            io.to(to).emit('webrtc-offer-multi', {
                offer,
                from: socket.id,
                streamType,
                sessionId
            });
        });

        // Multi-stream WebRTC answer
        socket.on('webrtc-answer-multi', (data) => {
            const { answer, to, streamType } = data;
            
            io.to(to).emit('webrtc-answer-multi', {
                answer,
                from: socket.id,
                streamType
            });
        });

        // ICE candidate for specific stream
        socket.on('webrtc-ice-candidate-multi', (data) => {
            const { candidate, to, streamType } = data;
            
            io.to(to).emit('webrtc-ice-candidate-multi', {
                candidate,
                from: socket.id,
                streamType
            });
        });

        // ========================================
        // Previous Socket Handlers (Updated)
        // ========================================

        // Join proctor dashboard room
        socket.on('join-proctor-dashboard', () =>
        {
            socket.join('proctor-dashboard');
            proctorDashboardSockets.add(socket.id);
            console.log(`Proctor joined dashboard: ${socket.id}`);
        });

        // Join interview room
        socket.on('join-interview', (data) =>
        {
            const {interviewId, userName, role}=data;
            socket.join(interviewId);

            console.log(`${userName} (${role}) joined interview ${interviewId}`);

            // Notify others in the room
            socket.to(interviewId).emit('user-joined', {
                userId: socket.id,
                userName,
                role,
            });

            // Notify proctor dashboard of new session
            io.to('proctor-dashboard').emit('session-update', {
                interviewId,
                type: 'user-joined',
                userName,
                role,
            });
        });

        // Leave interview room
        socket.on('leave-interview', (data) =>
        {
            const {interviewId}=data;
            socket.leave(interviewId);

            socket.to(interviewId).emit('user-left', {
                userId: socket.id,
            });
        });

        // WebRTC signaling - offer
        socket.on('webrtc-offer', (data) =>
        {
            const {offer, to}=data;
            io.to(to).emit('webrtc-offer', {
                offer,
                from: socket.id,
            });
        });

        // WebRTC signaling - answer
        socket.on('webrtc-answer', (data) =>
        {
            const {answer, to}=data;
            io.to(to).emit('webrtc-answer', {
                answer,
                from: socket.id,
            });
        });

        // WebRTC signaling - ICE candidate
        socket.on('webrtc-ice-candidate', (data) =>
        {
            const {candidate, to}=data;
            io.to(to).emit('webrtc-ice-candidate', {
                candidate,
                from: socket.id,
            });
        });

        // Code updates (real-time collaboration)
        socket.on('code-update', (data) =>
        {
            const {interviewId, code, language}=data;
            socket.to(interviewId).emit('code-update', {
                code,
                language,
                from: socket.id,
            });
        });

        // Question updates (interviewer changes question)
        socket.on('question-update', (data) =>
        {
            const {interviewId, question}=data;
            console.log(`Question updated in interview ${interviewId}:`, question.title);
            socket.to(interviewId).emit('question-update', {
                question,
                from: socket.id,
            });
        });

        // Chat messages
        socket.on('chat-message', (data) =>
        {
            const {interviewId, message, userName}=data;
            io.to(interviewId).emit('chat-message', {
                message,
                userName,
                timestamp: new Date(),
                from: socket.id,
            });
        });

        // Proctoring events
        socket.on('proctoring-event', (data) =>
        {
            const {interviewId, event}=data;

            // Notify recruiter about the event
            socket.to(interviewId).emit('proctoring-alert', {
                event,
                timestamp: new Date(),
            });

            // Notify proctor dashboard
            io.to('proctor-dashboard').emit('proctoring-alert', {
                interviewId,
                event,
                timestamp: new Date(),
            });
        });

        // Secondary camera - register mapping
        socket.on('register-secondary-camera', (data) =>
        {
            const {interviewId, code}=data;
            secondaryCameraMappings.set(code, {
                interviewId,
                mainSocketId: socket.id
            });
            console.log(`📱 Secondary camera registered: ${code} for interview ${interviewId}`);
        });

        // Secondary camera - phone connection
        socket.on('connect-secondary-camera', (data) =>
        {
            const {code, status}=data;
            const mapping=secondaryCameraMappings.get(code);

            if (mapping)
            {
                // Store phone socket ID
                mapping.phoneSocketId=socket.id;
                secondaryCameraMappings.set(code, mapping);

                // Notify main device
                io.to(mapping.mainSocketId).emit('secondary-camera-connected', {
                    status,
                    timestamp: new Date()
                });

                console.log(`📱 Secondary camera connected: ${code}`);
            }
        });

        // Secondary camera - receive snapshot
        socket.on('secondary-snapshot', (data) =>
        {
            const {code, snapshot}=data;
            const mapping=secondaryCameraMappings.get(code);

            if (mapping)
            {
                // Forward snapshot to main device and recruiter in the room
                io.to(mapping.mainSocketId).emit('secondary-snapshot', {
                    snapshot,
                    timestamp: new Date()
                });

                // Also send to interview room for recruiter
                socket.to(mapping.interviewId).emit('secondary-snapshot', {
                    snapshot,
                    timestamp: new Date()
                });

                // Remove from proctor dashboard if applicable
                if (proctorDashboardSockets.has(socket.id))
                {
                    proctorDashboardSockets.delete(socket.id);
                }
            }
        });

        // Disconnect
        socket.on('disconnect', () =>
        {
            console.log(`User disconnected: ${socket.id}`);
            
            // Handle live interview disconnection
            for (const [sessionId, room] of liveInterviewRooms) {
                if (room.participants.has(socket.id)) {
                    const participant = room.participants.get(socket.id);
                    room.participants.delete(socket.id);
                    room.screenShares.delete(socket.id);
                    
                    // Notify others
                    io.to(`live-${sessionId}`).emit('participant-left', {
                        socketId: socket.id,
                        userName: participant.userName,
                        role: participant.role
                    });
                    
                    // Notify proctor dashboard
                    io.to('proctor-dashboard').emit('live-session-update', {
                        sessionId,
                        type: 'participant-left',
                        participant: { userName: participant.userName, role: participant.role }
                    });
                    
                    console.log(`📴 ${participant.userName} left live interview ${sessionId}`);
                }
            }
            
            // Clean up proctor dashboard
            proctorDashboardSockets.delete(socket.id);
        });
        
        // Helper function for live interview leave
        function handleLiveInterviewLeave(sock, sessionId) {
            const room = liveInterviewRooms.get(sessionId);
            if (room && room.participants.has(sock.id)) {
                const participant = room.participants.get(sock.id);
                room.participants.delete(sock.id);
                room.screenShares.delete(sock.id);
                
                sock.leave(`live-${sessionId}`);
                
                // Notify others
                sock.to(`live-${sessionId}`).emit('participant-left', {
                    socketId: sock.id,
                    userName: participant.userName,
                    role: participant.role
                });
            }
        }

        // ========================================
        // Axiom AI Chat Handlers
        // ========================================

        // Handle AI chat messages
        socket.on('ai-message', async (data) =>
        {
            try
            {
                const {chatId, content, userId='anonymous'}=data;

                if (!chatId||!content)
                {
                    socket.emit('ai-error', {error: 'Missing chatId or content'});
                    return;
                }

                console.log(`📨 AI message from ${userId} in chat ${chatId}`);

                // Add user message
                const userMessage=addMessage(chatId, {
                    role: 'user',
                    content,
                    userId
                });

                // Generate embedding for user message
                const userVector=await geminiAI.generateEmbedding(content);

                // Store in Pinecone only if we have a valid vector
                if (userVector&&userVector.length>0)
                {
                    await pineconeService.createMemory(
                        userVector,
                        {
                            chatId,
                            userId,
                            role: 'user',
                            text: content
                        },
                        userMessage.id
                    );
                }

                // Query long-term memory only if we have a valid vector
                let memories=[];
                if (userVector&&userVector.length>0)
                {
                    memories=await pineconeService.queryMemory(
                        userVector,
                        3,
                        {chatId}
                    );
                }

                // Get recent chat history (short-term memory)
                const chatHistory=getChatMessages(chatId).slice(-10);

                // Format context for AI
                const memoryContext=memories.length>0
                    ? `\n\nRelevant past context:\n${memories.map(m => m.metadata?.text||'').join('\n')}`
                    :'';

                const conversationHistory=chatHistory.map(msg => ({
                    role: msg.role,
                    content: msg.content
                }));

                // Add memory context as system message
                if (memoryContext)
                {
                    conversationHistory.unshift({
                        role: 'user',
                        content: `Here's some relevant context from previous conversations:${memoryContext}\n\nNow, let's continue our current conversation.`
                    });
                }

                // Generate AI response
                const aiResponse=await geminiAI.generateResponse(
                    conversationHistory,
                    "You are Aurora, a helpful and knowledgeable AI assistant. Be conversational, friendly, and provide clear, accurate information."
                );

                // Add AI message
                const aiMessage=addMessage(chatId, {
                    role: 'model',
                    content: aiResponse,
                    userId: 'aurora'
                });

                // Generate embedding for AI response
                const aiVector=await geminiAI.generateEmbedding(aiResponse);

                // Store AI response in Pinecone only if we have a valid vector
                if (aiVector&&aiVector.length>0)
                {
                    await pineconeService.createMemory(
                        aiVector,
                        {
                            chatId,
                            userId,
                            role: 'model',
                            text: aiResponse
                        },
                        aiMessage.id
                    );
                }

                // Send response back to client
                socket.emit('ai-response', {
                    content: aiResponse,
                    chatId,
                    messageId: aiMessage.id,
                    timestamp: aiMessage.timestamp
                });

                console.log(`✅ AI response sent for chat ${chatId}`);
            } catch (error)
            {
                console.error('AI message error:', error);
                socket.emit('ai-error', {
                    error: 'Failed to process message',
                    details: error.message
                });
            }
        });
    });
}
