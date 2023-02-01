-- Base schema recreation SQL file. This SQL file creates an empty database
-- with the schema that must have existed just before we started using
-- typeorm migrations. I.e. if you initialize an empty DB with this then
-- you can run all existing migrations and will end up with an empty database
-- with the most recent schema.

-- There are a few minor differences between what must have been the state before
-- migrations began and what this file achives. They are enumerated below.

-- One difference is that we assume Mysql 8 already from the start and create all
-- tables with charset utf8mb4 and collation utf8mb4_0900_as_cs. Historically
-- that was not the case and there is an explicit migration that changed this but that
-- just becomes a no-op now.

-- Another difference is that the user_invitations table gets dropped at some point
-- in the migrations and I didn't want to bother searching for the original create
-- statement so we just create a dummy table with that name so that the drop works.

CREATE TABLE `user_invitations` (
    `id` int unsigned NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE `knex_migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  `batch` int DEFAULT NULL,
  `migration_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE `knex_migrations_lock` (
  `index` int unsigned NOT NULL AUTO_INCREMENT,
  `is_locked` int DEFAULT NULL,
  PRIMARY KEY (`index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE `migrations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `timestamp` bigint NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `password` varchar(128) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  `lastLogin` datetime DEFAULT NULL,
  `isSuperuser` tinyint(1) NOT NULL DEFAULT '0',
  `email` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `fullName` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
  `lastSeen` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE `sessions` (
  `session_key` varchar(40) COLLATE utf8mb4_0900_as_cs NOT NULL,
  `session_data` longtext COLLATE utf8mb4_0900_as_cs NOT NULL,
  `expire_date` datetime NOT NULL,
  PRIMARY KEY (`session_key`),
  KEY `django_session_expire_date_a5c62663` (`expire_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE `settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `meta_name` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
  `meta_value` longtext COLLATE utf8mb4_0900_as_cs NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE `posts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` mediumtext COLLATE utf8mb4_0900_as_cs NOT NULL,
  `slug` mediumtext COLLATE utf8mb4_0900_as_cs NOT NULL,
  `type` mediumtext COLLATE utf8mb4_0900_as_cs NOT NULL,
  `status` mediumtext COLLATE utf8mb4_0900_as_cs NOT NULL,
  `content` longtext COLLATE utf8mb4_0900_as_cs NOT NULL,
--   `archieml` json DEFAULT NULL,
--   `archieml_update_statistics` json DEFAULT NULL,
  `published_at` datetime DEFAULT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE `namespaces` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  `isArchived` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `namespaces_name_uq` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE `entities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(255) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
  `validated` tinyint(1) NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `displayName` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE `importer_additionalcountryinfo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `country_code` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
  `country_name` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
  `country_wb_region` varchar(255) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  `country_wb_income_group` varchar(255) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  `country_special_notes` longtext COLLATE utf8mb4_0900_as_cs,
  `country_latest_census` varchar(255) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  `country_latest_survey` varchar(255) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  `country_recent_income_source` varchar(255) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  `dataset` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE `importer_importhistory` (
  `id` int NOT NULL AUTO_INCREMENT,
  `import_type` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
  `import_time` datetime NOT NULL,
  `import_notes` longtext COLLATE utf8mb4_0900_as_cs NOT NULL,
  `import_state` longtext COLLATE utf8mb4_0900_as_cs NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;


CREATE TABLE `datasets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(512) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  `description` longtext COLLATE utf8mb4_0900_as_cs NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `namespace` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
  `isPrivate` tinyint(1) NOT NULL DEFAULT '0',
  `createdByUserId` int NOT NULL,
  `metadataEditedAt` datetime NOT NULL,
  `metadataEditedByUserId` int NOT NULL,
  `dataEditedAt` datetime NOT NULL,
  `dataEditedByUserId` int NOT NULL,
  -- `nonRedistributable` tinyint(1) NOT NULL DEFAULT '0',
--   `isArchived` tinyint(1) NOT NULL DEFAULT '0',
--   `sourceChecksum` varchar(64) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
--   `shortName` varchar(255) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
--   `version` varchar(255) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `datasets_name_namespace_d3d60d22_uniq` (`name`,`namespace`),
--   UNIQUE KEY `unique_short_name_version_namespace` (`shortName`,`version`,`namespace`),
  KEY `datasets_metadataEditedByUserId` (`metadataEditedByUserId`),
  KEY `datasets_dataEditedByUserId` (`dataEditedByUserId`),
  KEY `datasets_createdByUserId` (`createdByUserId`),
  CONSTRAINT `datasets_createdByUserId` FOREIGN KEY (`createdByUserId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `datasets_dataEditedByUserId` FOREIGN KEY (`dataEditedByUserId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `datasets_metadataEditedByUserId` FOREIGN KEY (`metadataEditedByUserId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;


CREATE TABLE `sources` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(512) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  `description` json NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `datasetId` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `sources_datasetId` (`datasetId`),
  CONSTRAINT `sources_datasetId` FOREIGN KEY (`datasetId`) REFERENCES `datasets` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE `variables` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(750) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  `unit` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
  `description` longtext COLLATE utf8mb4_0900_as_cs,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `code` varchar(255) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  `coverage` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
  `timespan` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
  `datasetId` int NOT NULL,
  `sourceId` int NOT NULL,
  `shortUnit` varchar(255) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  `display` json NOT NULL,
  `columnOrder` int NOT NULL DEFAULT '0',
  `originalMetadata` json DEFAULT NULL,
--   `grapherConfig` json DEFAULT NULL,
--   `shortName` varchar(255) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
--   `catalogPath` text COLLATE utf8mb4_0900_as_cs,
--   `dimensions` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `variables_name_fk_dst_id_f7453c33_uniq` (`name`,`datasetId`),
  UNIQUE KEY `variables_code_fk_dst_id_7bde8c2a_uniq` (`code`,`datasetId`),
--   UNIQUE KEY `unique_short_name_per_dataset` (`shortName`,`datasetId`),
  KEY `variables_sourceId_31fce80a_fk_sources_id` (`sourceId`),
  KEY `variables_datasetId_50a98bfd_fk_datasets_id` (`datasetId`),
  CONSTRAINT `variables_datasetId_50a98bfd_fk_datasets_id` FOREIGN KEY (`datasetId`) REFERENCES `datasets` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `variables_sourceId_31fce80a_fk_sources_id` FOREIGN KEY (`sourceId`) REFERENCES `sources` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE `charts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `config` json NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `lastEditedAt` datetime NOT NULL,
  `publishedAt` datetime DEFAULT NULL,
  `lastEditedByUserId` int NOT NULL,
  `publishedByUserId` int DEFAULT NULL,
  `is_indexable` tinyint(1) NOT NULL DEFAULT '0',
  `isExplorable` tinyint(1) NOT NULL DEFAULT '0',
  `starred` TINYINT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `charts_lastEditedByUserId` (`lastEditedByUserId`),
  KEY `charts_publishedByUserId` (`publishedByUserId`),
  CONSTRAINT `charts_lastEditedByUserId` FOREIGN KEY (`lastEditedByUserId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `charts_publishedByUserId` FOREIGN KEY (`publishedByUserId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE `tags` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `parentId` int DEFAULT NULL,
  `isBulkImport` tinyint(1) NOT NULL DEFAULT '0',
  `specialType` varchar(255) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dataset_subcategories_name_fk_dst_cat_id_6ce1cc36_uniq` (`name`,`parentId`),
  KEY `parentId` (`parentId`),
  CONSTRAINT `tags_ibfk_1` FOREIGN KEY (`parentId`) REFERENCES `tags` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;


CREATE TABLE `chart_dimensions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order` int NOT NULL,
  `property` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
  `chartId` int NOT NULL,
  `variableId` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `chart_dimensions_chartId_78d6a092_fk_charts_id` (`chartId`),
  KEY `chart_dimensions_variableId_9ba778e6_fk_variables_id` (`variableId`),
  CONSTRAINT `chart_dimensions_chartId_78d6a092_fk_charts_id` FOREIGN KEY (`chartId`) REFERENCES `charts` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `chart_dimensions_variableId_9ba778e6_fk_variables_id` FOREIGN KEY (`variableId`) REFERENCES `variables` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE `chart_revisions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `chartId` int DEFAULT NULL,
  `userId` int DEFAULT NULL,
  `config` json DEFAULT NULL,
  `createdAt` datetime DEFAULT NULL,
  `updatedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `chartId` (`chartId`),
  KEY `chart_revisions_userId` (`userId`),
  CONSTRAINT `chart_revisions_userId` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE `chart_slug_redirects` (
  `id` int NOT NULL AUTO_INCREMENT,
  `slug` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
  `chart_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `chart_slug_redirects_chart_id` (`chart_id`),
  CONSTRAINT `chart_slug_redirects_chart_id` FOREIGN KEY (`chart_id`) REFERENCES `charts` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE `chart_tags` (
  `chartId` int NOT NULL,
  `tagId` int NOT NULL,
--   `isKey` tinyint unsigned DEFAULT NULL,
  PRIMARY KEY (`chartId`,`tagId`),
  KEY `FK_chart_tags_tagId` (`tagId`),
  CONSTRAINT `FK_chart_tags_chartId` FOREIGN KEY (`chartId`) REFERENCES `charts` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `FK_chart_tags_tagId` FOREIGN KEY (`tagId`) REFERENCES `tags` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;



CREATE TABLE `country_latest_data` (
  `country_code` varchar(255) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  `variable_id` int DEFAULT NULL,
  `year` int DEFAULT NULL,
  `value` varchar(255) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  UNIQUE KEY `country_latest_data_country_code_variable_id_unique` (`country_code`,`variable_id`),
  KEY `country_latest_data_variable_id_foreign` (`variable_id`),
  CONSTRAINT `country_latest_data_variable_id_foreign` FOREIGN KEY (`variable_id`) REFERENCES `variables` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE `country_name_tool_continent` (
  `id` int NOT NULL AUTO_INCREMENT,
  `continent_code` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
  `continent_name` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `continent_code` (`continent_code`),
  UNIQUE KEY `continent_name` (`continent_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE `country_name_tool_countrydata` (
  `id` int NOT NULL AUTO_INCREMENT,
  `owid_name` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
  `iso_alpha2` varchar(255) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  `iso_alpha3` varchar(255) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  `imf_code` int DEFAULT NULL,
  `cow_letter` varchar(255) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  `cow_code` int DEFAULT NULL,
  `unctad_code` varchar(255) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  `marc_code` varchar(255) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  `ncd_code` varchar(255) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  `kansas_code` varchar(255) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  `penn_code` varchar(255) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
  `continent` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `owid_name` (`owid_name`),
  UNIQUE KEY `iso_alpha2` (`iso_alpha2`),
  UNIQUE KEY `iso_alpha3` (`iso_alpha3`),
  UNIQUE KEY `imf_code` (`imf_code`),
  UNIQUE KEY `cow_letter` (`cow_letter`),
  UNIQUE KEY `cow_code` (`cow_code`),
  UNIQUE KEY `unctad_code` (`unctad_code`),
  UNIQUE KEY `marc_code` (`marc_code`),
  UNIQUE KEY `ncd_code` (`ncd_code`),
  UNIQUE KEY `kansas_code` (`kansas_code`),
  UNIQUE KEY `penn_code` (`penn_code`),
  KEY `country_name_tool_co_continent_217c90d2_fk_country_n` (`continent`),
  CONSTRAINT `country_name_tool_co_continent_217c90d2_fk_country_n` FOREIGN KEY (`continent`) REFERENCES `country_name_tool_continent` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE `country_name_tool_countryname` (
  `id` int NOT NULL AUTO_INCREMENT,
  `country_name` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
  `owid_country` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `country_name` (`country_name`),
  KEY `country_name_tool_co_owid_country_fefc8efa_fk_country_n` (`owid_country`),
  CONSTRAINT `country_name_tool_co_owid_country_fefc8efa_fk_country_n` FOREIGN KEY (`owid_country`) REFERENCES `country_name_tool_countrydata` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE `data_values` (
  `value` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
  `year` int NOT NULL,
  `entityId` int NOT NULL,
  `variableId` int NOT NULL,
  PRIMARY KEY (`variableId`,`entityId`,`year`),
  UNIQUE KEY `data_values_fk_ent_id_fk_var_id_year_e0eee895_uniq` (`entityId`,`variableId`,`year`),
  KEY `data_values_variableId_variables_id` (`variableId`),
  KEY `data_values_year` (`year`),
  CONSTRAINT `data_values_entityId_entities_id` FOREIGN KEY (`entityId`) REFERENCES `entities` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `data_values_variableId_variables_id` FOREIGN KEY (`variableId`) REFERENCES `variables` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE `dataset_files` (
  `datasetId` int NOT NULL,
  `filename` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
  `file` longblob NOT NULL,
  KEY `dataset_files_datasetId` (`datasetId`),
  CONSTRAINT `dataset_files_datasetId` FOREIGN KEY (`datasetId`) REFERENCES `datasets` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE `dataset_tags` (
  `datasetId` int NOT NULL,
  `tagId` int NOT NULL,
  PRIMARY KEY (`datasetId`,`tagId`),
  KEY `FK_2e330c9e1074b457d1d238b2dac` (`tagId`),
  CONSTRAINT `FK_2e330c9e1074b457d1d238b2dac` FOREIGN KEY (`tagId`) REFERENCES `tags` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `FK_fa434de5c36953f4efce6b073b3` FOREIGN KEY (`datasetId`) REFERENCES `datasets` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

-- CREATE TABLE `details` (
--   `id` int NOT NULL AUTO_INCREMENT,
--   `category` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
--   `term` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
--   `title` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
--   `content` varchar(1023) COLLATE utf8mb4_0900_as_cs NOT NULL,
--   PRIMARY KEY (`id`),
--   UNIQUE KEY `category` (`category`,`term`)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;










CREATE TABLE `post_tags` (
  `post_id` int NOT NULL,
  `tag_id` int NOT NULL,
  PRIMARY KEY (`post_id`,`tag_id`),
  KEY `FK_post_tags_tag_id` (`tag_id`),
  CONSTRAINT `FK_post_tags_post_id` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `FK_post_tags_tag_id` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;



-- CREATE TABLE `posts_gdocs` (
--   `id` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
--   `slug` varchar(255) COLLATE utf8mb4_0900_as_cs NOT NULL,
--   `content` json NOT NULL,
--   `published` tinyint NOT NULL,
--   `createdAt` datetime NOT NULL,
--   `publishedAt` datetime DEFAULT NULL,
--   `updatedAt` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
--   `publicationContext` enum('unlisted','listed') COLLATE utf8mb4_0900_as_cs NOT NULL DEFAULT 'unlisted',
--   `revisionId` varchar(255) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
--   PRIMARY KEY (`id`)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;



-- CREATE TABLE `suggested_chart_revisions` (
--   `id` bigint NOT NULL AUTO_INCREMENT,
--   `chartId` int NOT NULL,
--   `createdBy` int NOT NULL,
--   `updatedBy` int DEFAULT NULL,
--   `originalConfig` json NOT NULL,
--   `suggestedConfig` json NOT NULL,
--   `status` varchar(8) COLLATE utf8mb4_0900_as_cs NOT NULL,
--   `suggestedReason` varchar(512) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
--   `decisionReason` varchar(512) COLLATE utf8mb4_0900_as_cs DEFAULT NULL,
--   `createdAt` datetime NOT NULL,
--   `updatedAt` datetime NOT NULL,
--   `originalVersion` int GENERATED ALWAYS AS (json_unquote(json_extract(`originalConfig`,_utf8mb4'$.version'))) VIRTUAL NOT NULL,
--   `suggestedVersion` int GENERATED ALWAYS AS (json_unquote(json_extract(`suggestedConfig`,_utf8mb4'$.version'))) VIRTUAL NOT NULL,
--   `isPendingOrFlagged` tinyint(1) GENERATED ALWAYS AS (if((`status` in (_utf8mb4'pending',_utf8mb4'flagged')),true,NULL)) VIRTUAL,
--   PRIMARY KEY (`id`),
--   UNIQUE KEY `chartId` (`chartId`,`originalVersion`,`suggestedVersion`,`isPendingOrFlagged`),
--   KEY `createdBy` (`createdBy`),
--   KEY `updatedBy` (`updatedBy`),
--   CONSTRAINT `suggested_chart_revisions_ibfk_1` FOREIGN KEY (`chartId`) REFERENCES `charts` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
--   CONSTRAINT `suggested_chart_revisions_ibfk_2` FOREIGN KEY (`createdBy`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
--   CONSTRAINT `suggested_chart_revisions_ibfk_3` FOREIGN KEY (`updatedBy`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
