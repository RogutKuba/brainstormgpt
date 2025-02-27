'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Home() {
  const [roomCode, setRoomCode] = useState<string>('');
  const router = useRouter();

  const handleCreateRoom = () => {
    const roomHash = (() => {
      // generate 8 random characters
      const values = crypto.getRandomValues(new Uint8Array(4));
      return Array.from(values)
        .map((value) => value.toString(36))
        .join('');
    })();

    router.push(`/room/${roomHash}`);
  };

  const handleJoinRoom = () => {
    router.push(`/room/${roomCode}`);
  };

  return (
    <div className='flex flex-col items-center justify-center min-h-screen bg-gray-50'>
      <div className='p-8 bg-white rounded-lg shadow-md w-full max-w-md'>
        <h1 className='text-2xl font-bold text-center mb-6 text-black'>
          BrainStorm GPT
        </h1>

        <div className='mb-6'>
          <button
            onClick={handleCreateRoom}
            className='w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75'
          >
            Create New Room
          </button>
        </div>

        <div className='mb-2'>
          <p className='text-center text-gray-600 mb-4'>- OR -</p>
          <label
            className='block text-gray-700 text-sm font-bold mb-2'
            htmlFor='roomCode'
          >
            Join with Room Code
          </label>
          <input
            id='roomCode'
            type='text'
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder='Enter room code'
            className='shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline'
          />
        </div>

        <button
          onClick={handleJoinRoom}
          disabled={!roomCode.trim()}
          className='w-full py-2 px-4 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 disabled:bg-gray-400 disabled:cursor-not-allowed'
        >
          Create Room
        </button>
      </div>
    </div>
  );
}
