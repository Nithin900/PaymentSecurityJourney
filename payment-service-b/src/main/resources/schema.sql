CREATE TABLE IF NOT EXISTS payments (

    payment_id VARCHAR(50) PRIMARY KEY,
    account_number VARCHAR(50) NOT NULL,
    amount DECIMAL(19, 2) NOT NULL
    );