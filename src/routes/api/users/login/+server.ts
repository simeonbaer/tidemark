import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { connectToDatabase } from '$lib/server/db';
import { ObjectId } from 'mongodb';

// Simple password hashing (in production, use bcrypt or similar)
async function hashPassword(password: string): Promise<string> {
	return Buffer.from(password).toString('base64');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
	return Buffer.from(password).toString('base64') === hash;
}

export const POST: RequestHandler = async ({ request }) => {
	if (request.method !== 'POST') {
		return json({ message: 'Method not allowed' }, { status: 405 });
	}

	try {
		const { email, password } = await request.json();

		if (!email || !password) {
			return json({ message: 'Email and password are required' }, { status: 400 });
		}

		const { db } = await connectToDatabase();
		const usersCollection = db.collection('users');

		// Find user by email
		const user = await usersCollection.findOne({ email });

		if (!user) {
			return json({ message: 'User not found' }, { status: 401 });
		}

		// Verify password
		const passwordMatch = await verifyPassword(password, user.password);

		if (!passwordMatch) {
			return json({ message: 'Invalid password' }, { status: 401 });
		}

		return json({
			userId: user._id.toString(),
			userName: user.username,
			email: user.email
		});
	} catch (error) {
		console.error('Login error:', error);
		return json({ message: 'Internal server error' }, { status: 500 });
	}
};
