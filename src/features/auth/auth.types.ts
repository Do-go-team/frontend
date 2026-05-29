export interface SendEmailCodeRequest {
	email: string;
}

export interface SendEmailCodeResponse {
	expires_in: number;
}

export interface VerifyEmailRequest {
	email: string;
	code: string;
}

export interface VerifyEmailResponse {
	is_verified: boolean;
	verification_token: string;
}

export interface SignupRequest {
	email: string;
	password: string;
	password_confirm: string;
	name: string;
	profile_image_url?: string;
	verification_token: string;
}

export interface SignupResponse {
	user_id: number;
	email: string;
	name: string;
	role: string;
	created_at: string;
}

export interface LoginRequest {
	email: string;
	password: string;
}

export interface LoginResponse {
	expires_in: number;
	user: {
		id: number;
		name: string;
		role: string;
	};
}

export interface MeResponse {
	id: number;
	email: string;
	name: string;
	profile_image_url: string | null;
	system_role: string;
	accessible_stores: Array<{
		store_id: number;
		store_name: string;
		store_role: string;
	}>;
}
