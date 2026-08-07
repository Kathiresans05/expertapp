import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      client.join(`user_${userId}`);
      console.log(`Socket client ${client.id} joined room user_${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Socket client ${client.id} disconnected`);
  }

  @SubscribeMessage('ping')
  handlePing(@MessageBody() data: any, @ConnectedSocket() client: Socket): void {
    client.emit('pong', { message: 'pong from server', data });
  }

  @SubscribeMessage('initiate_call')
  handleInitiateCall(@MessageBody() data: any, @ConnectedSocket() client: Socket): void {
    const { targetUserId, channelName, callerName, callerId, callType, pricePerMinute } = data;
    console.log(`Call initiated from ${callerName} to target ${targetUserId} in channel ${channelName} at ₹${pricePerMinute}/min`);
    
    // Broadcast incoming_call to specific user room and globally for testing
    this.server.to(`user_${targetUserId}`).emit('incoming_call', {
      channelName: channelName || `room_${Date.now()}`,
      callerName: callerName || 'Customer',
      callerId: callerId || 'cust_1',
      callType: callType || 'audio',
      pricePerMinute: pricePerMinute ? Number(pricePerMinute) : 3.0,
    });

    this.server.emit('incoming_call', {
      channelName: channelName || `room_${Date.now()}`,
      callerName: callerName || 'Customer',
      callerId: callerId || 'cust_1',
      callType: callType || 'audio',
      pricePerMinute: pricePerMinute ? Number(pricePerMinute) : 3.0,
    });
  }

  @SubscribeMessage('accept_call')
  handleAcceptCall(@MessageBody() data: any, @ConnectedSocket() client: Socket): void {
    const { channelName, callerId } = data;
    console.log(`Call accepted for channel ${channelName}`);
    this.server.to(`user_${callerId}`).emit('call_accepted', {
      channelName,
      status: 'accepted',
    });
    this.server.emit('call_accepted', {
      channelName,
      status: 'accepted',
    });
  }

  @SubscribeMessage('reject_call')
  handleRejectCall(@MessageBody() data: any, @ConnectedSocket() client: Socket): void {
    const { channelName, callerId } = data;
    console.log(`Call rejected for channel ${channelName}`);
    this.server.to(`user_${callerId}`).emit('call_rejected', {
      channelName,
      reason: 'busy',
    });
    this.server.emit('call_rejected', {
      channelName,
      reason: 'busy',
    });
  }

  @SubscribeMessage('end_call')
  handleEndCall(@MessageBody() data: any, @ConnectedSocket() client: Socket): void {
    const { channelName, durationSeconds } = data;
    console.log(`Call ended for channel ${channelName}, duration: ${durationSeconds}s`);
    this.server.emit('call_ended', {
      channelName,
      durationSeconds: durationSeconds || 0,
    });
  }

  @SubscribeMessage('send_message')
  handleSendMessage(@MessageBody() data: any, @ConnectedSocket() client: Socket): void {
    const { senderId, senderName, targetUserId, text, channelId } = data;
    console.log(`Chat message from ${senderName} (${senderId}) to ${targetUserId}: ${text}`);

    const payload = {
      senderId,
      senderName: senderName || 'User',
      targetUserId,
      text,
      channelId: channelId || `chat_${senderId}_${targetUserId}`,
      timestamp: new Date().toISOString(),
    };

    this.server.to(`user_${targetUserId}`).emit('receive_message', payload);
    this.server.emit('receive_message', payload);
  }
}
