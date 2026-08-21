CREATE TABLE `rag_queries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transcript` text NOT NULL,
	`normalizedQuery` text NOT NULL,
	`answer` text,
	`answerMode` varchar(32) NOT NULL,
	`guardrailStatus` varchar(16) NOT NULL,
	`guardrailReasons` json NOT NULL,
	`sourcePayload` json NOT NULL,
	`latencyPayload` json NOT NULL,
	`transcriptionProvider` varchar(32),
	`retrievalToAnswerMs` int NOT NULL,
	`transcriptionMs` int,
	`totalMs` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rag_queries_id` PRIMARY KEY(`id`)
);
