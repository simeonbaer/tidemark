import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { connectToDatabase } from '$lib/server/db';

// Simple password hashing (in production, use bcrypt or similar)
async function hashPassword(password: string): Promise<string> {
	return Buffer.from(password).toString('base64');
}

export const POST: RequestHandler = async ({ request }) => {
	if (request.method !== 'POST') {
		return json({ message: 'Method not allowed' }, { status: 405 });
	}

	try {
		const { username, email, password, skillLevel } = await request.json();

		if (!username || !email || !password || !skillLevel) {
			return json({ message: 'All fields are required' }, { status: 400 });
		}

		const { db } = await connectToDatabase();
		const usersCollection = db.collection('users');

		// Check if user already exists
		const existingUser = await usersCollection.findOne({ $or: [{ email }, { username }] });

		if (existingUser) {
			return json(
				{ message: 'User with this email or username already exists' },
				{ status: 409 }
			);
		}

		// Hash password
		const hashedPassword = await hashPassword(password);

		// Create new user
		const result = await usersCollection.insertOne({
			username,
			email,
			password: hashedPassword,
			skillLevel,
			createdAt: new Date(),
			stats: {
				wins: 0,
				losses: 0,
				draws: 0
			}
		});

		return json(
			{
				userId: result.insertedId.toString(),
				message: 'User registered successfully'
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Registration error:', error);
		return json({ message: 'Internal server error' }, { status: 500 });
	}
};
