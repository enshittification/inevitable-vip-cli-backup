export const WORDPRESS_APPLICATION_TYPE_ID = 2;
export const WORDPRESS_NON_PROD_APPLICATION_TYPE_ID = 6;
export const WORDPRESS_SITE_TYPE_IDS = [
	WORDPRESS_APPLICATION_TYPE_ID,
	WORDPRESS_NON_PROD_APPLICATION_TYPE_ID,
];

export const NODEJS_APPLICATION_TYPE_ID = 3;
export const NODEJS_MYSQL_APPLICATION_TYPE_ID = 5;
export const NODEJS_REDIS_APPLICATION_TYPE_ID = 7;
export const NODEJS_MYSQL_REDIS_APPLICATION_TYPE_ID = 8;
export const NODEJS_SITE_TYPE_IDS = [
	NODEJS_APPLICATION_TYPE_ID,
	NODEJS_MYSQL_APPLICATION_TYPE_ID,
	NODEJS_REDIS_APPLICATION_TYPE_ID,
	NODEJS_MYSQL_REDIS_APPLICATION_TYPE_ID,
];

export const DATABASE_APPLICATION_TYPE_IDS = [
	WORDPRESS_APPLICATION_TYPE_ID,
	WORDPRESS_NON_PROD_APPLICATION_TYPE_ID,
	NODEJS_MYSQL_APPLICATION_TYPE_ID,
	NODEJS_MYSQL_REDIS_APPLICATION_TYPE_ID,
];
