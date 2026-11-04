CREATE TABLE quote_audit_log (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    quote_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    changes JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_quote_audit_quote (quote_id, created_at),

    CONSTRAINT fk_quote_audit_quote
        FOREIGN KEY (quote_id)
        REFERENCES quotes(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_quote_audit_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
) ENGINE=InnoDB;
