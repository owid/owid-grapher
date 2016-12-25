-- MySQL dump 10.13  Distrib 5.5.53, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: forge
-- ------------------------------------------------------
-- Server version	5.5.53-0ubuntu0.14.04.1-log

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `api_keys`
--

DROP TABLE IF EXISTS `api_keys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `api_keys` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8_unicode_ci NOT NULL,
  `value` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `updated_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `chart_dimensions`
--

DROP TABLE IF EXISTS `chart_dimensions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chart_dimensions` (
  `chartId` int(10) unsigned NOT NULL,
  `order` int(10) unsigned NOT NULL,
  `variableId` int(10) unsigned NOT NULL,
  `property` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `unit` varchar(255) COLLATE utf8_unicode_ci NOT NULL DEFAULT '',
  `displayName` varchar(255) COLLATE utf8_unicode_ci NOT NULL DEFAULT '',
  `targetYear` int(11) DEFAULT NULL,
  `tolerance` int(11) NOT NULL DEFAULT '5',
  `color` varchar(255) COLLATE utf8_unicode_ci NOT NULL DEFAULT '',
  KEY `chart_dimensions_variableid_foreign` (`variableId`),
  KEY `chart_dimensions_chartid_foreign` (`chartId`),
  CONSTRAINT `chart_dimensions_chartid_foreign` FOREIGN KEY (`chartId`) REFERENCES `charts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chart_dimensions_variableid_foreign` FOREIGN KEY (`variableId`) REFERENCES `variables` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `chart_slug_redirects`
--

DROP TABLE IF EXISTS `chart_slug_redirects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chart_slug_redirects` (
  `slug` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `chart_id` int(10) unsigned NOT NULL,
  UNIQUE KEY `chart_slug_redirects_slug_unique` (`slug`),
  KEY `chart_slug_redirects_chart_id_foreign` (`chart_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `chart_type_dimensions`
--

DROP TABLE IF EXISTS `chart_type_dimensions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chart_type_dimensions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `property` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `type` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `fk_chart_type_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `chart_type_dimensions_fk_chart_type_id_foreign` (`fk_chart_type_id`),
  CONSTRAINT `chart_type_dimensions_fk_chart_type_id_foreign` FOREIGN KEY (`fk_chart_type_id`) REFERENCES `chart_types` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `charts`
--

DROP TABLE IF EXISTS `charts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `charts` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `config` text COLLATE utf8_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `updated_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `last_edited_by` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `last_edited_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `origin_url` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `notes` text COLLATE utf8_unicode_ci NOT NULL,
  `slug` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `published` tinyint(1) DEFAULT NULL,
  `starred` tinyint(1) NOT NULL DEFAULT '0',
  `type` enum('LineChart','ScatterPlot','StackedArea','MultiBar','HorizontalMultiBar','DiscreteBar') COLLATE utf8_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `charts_slug_unique` (`slug`,`published`),
  KEY `charts_last_edited_by_foreign` (`last_edited_by`),
  CONSTRAINT `charts_last_edited_by_foreign` FOREIGN KEY (`last_edited_by`) REFERENCES `users` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=405 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `data_values`
--

DROP TABLE IF EXISTS `data_values`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `data_values` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `value` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `fk_ent_id` int(10) unsigned DEFAULT NULL,
  `fk_var_id` int(10) unsigned NOT NULL,
  `year` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`fk_var_id`,`fk_ent_id`,`year`),
  KEY `data_values_fk_ent_id_foreign` (`fk_ent_id`),
  KEY `data_values_fk_var_id_foreign` (`fk_var_id`),
  CONSTRAINT `data_values_fk_ent_id_foreign` FOREIGN KEY (`fk_ent_id`) REFERENCES `entities` (`id`),
  CONSTRAINT `data_values_fk_var_id_foreign` FOREIGN KEY (`fk_var_id`) REFERENCES `variables` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3716282 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dataset_categories`
--

DROP TABLE IF EXISTS `dataset_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `dataset_categories` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `updated_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  PRIMARY KEY (`id`),
  UNIQUE KEY `dataset_categories_name_unique` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dataset_subcategories`
--

DROP TABLE IF EXISTS `dataset_subcategories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `dataset_subcategories` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `fk_dst_cat_id` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `updated_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  PRIMARY KEY (`id`),
  UNIQUE KEY `dataset_subcategories_name_unique` (`name`,`fk_dst_cat_id`),
  KEY `dataset_subcategories_fk_dst_cat_id_foreign` (`fk_dst_cat_id`),
  CONSTRAINT `dataset_subcategories_fk_dst_cat_id_foreign` FOREIGN KEY (`fk_dst_cat_id`) REFERENCES `dataset_categories` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=375 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dataset_tags`
--

DROP TABLE IF EXISTS `dataset_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `dataset_tags` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `updated_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=172 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `datasets`
--

DROP TABLE IF EXISTS `datasets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `datasets` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `fk_dst_cat_id` int(10) unsigned DEFAULT NULL,
  `fk_dst_subcat_id` int(10) unsigned DEFAULT NULL,
  `namespace` varchar(255) COLLATE utf8_unicode_ci NOT NULL DEFAULT 'owid',
  PRIMARY KEY (`id`),
  UNIQUE KEY `dataset_names_unique` (`name`,`namespace`),
  KEY `datasets_fk_dst_cat_id_foreign` (`fk_dst_cat_id`),
  KEY `datasets_fk_dst_subcat_id_foreign` (`fk_dst_subcat_id`),
  CONSTRAINT `datasets_fk_dst_cat_id_foreign` FOREIGN KEY (`fk_dst_cat_id`) REFERENCES `dataset_categories` (`id`),
  CONSTRAINT `datasets_fk_dst_subcat_id_foreign` FOREIGN KEY (`fk_dst_subcat_id`) REFERENCES `dataset_subcategories` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=328 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `django_migrations`
--

DROP TABLE IF EXISTS `django_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `django_migrations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `app` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `applied` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `entities`
--

DROP TABLE IF EXISTS `entities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `entities` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `validated` tinyint(4) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `updated_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  PRIMARY KEY (`id`),
  UNIQUE KEY `entities_name_unique` (`name`),
  UNIQUE KEY `entities_code_unique` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=10900 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `input_files`
--

DROP TABLE IF EXISTS `input_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `input_files` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `raw_data` text COLLATE utf8_unicode_ci NOT NULL,
  `fk_user_id` int(10) unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `updated_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  PRIMARY KEY (`id`),
  KEY `input_files_fk_user_id_foreign` (`fk_user_id`),
  CONSTRAINT `input_files_fk_user_id_foreign` FOREIGN KEY (`fk_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=227 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `jobs`
--

DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `payload` text COLLATE utf8_unicode_ci NOT NULL,
  `attempts` tinyint(3) unsigned NOT NULL,
  `reserved` tinyint(3) unsigned NOT NULL,
  `reserved_at` int(10) unsigned DEFAULT NULL,
  `available_at` int(10) unsigned NOT NULL,
  `created_at` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `licenses`
--

DROP TABLE IF EXISTS `licenses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `licenses` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `description` text COLLATE utf8_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `updated_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `link_datasets_tags`
--

DROP TABLE IF EXISTS `link_datasets_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `link_datasets_tags` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `fk_dst_id` int(10) unsigned NOT NULL,
  `fk_dst_tags_id` int(10) unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `updated_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  PRIMARY KEY (`id`),
  KEY `link_datasets_tags_fk_dst_id_foreign` (`fk_dst_id`),
  KEY `link_datasets_tags_fk_dst_tags_id_foreign` (`fk_dst_tags_id`),
  CONSTRAINT `link_datasets_tags_fk_dst_id_foreign` FOREIGN KEY (`fk_dst_id`) REFERENCES `datasets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `link_datasets_tags_fk_dst_tags_id_foreign` FOREIGN KEY (`fk_dst_tags_id`) REFERENCES `dataset_tags` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=172 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `logos`
--

DROP TABLE IF EXISTS `logos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `logos` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `svg` text NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=7 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `password_resets`
--

DROP TABLE IF EXISTS `password_resets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `password_resets` (
  `email` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `token` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  KEY `password_resets_email_index` (`email`),
  KEY `password_resets_token_index` (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sessions` (
  `id` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8_unicode_ci,
  `payload` text COLLATE utf8_unicode_ci NOT NULL,
  `last_activity` int(11) NOT NULL,
  UNIQUE KEY `sessions_id_unique` (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `settings`
--

DROP TABLE IF EXISTS `settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `settings` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `meta_name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `meta_value` text COLLATE utf8_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `updated_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sources`
--

DROP TABLE IF EXISTS `sources`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sources` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `description` text COLLATE utf8_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `updated_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `datasetId` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`name`,`datasetId`)
) ENGINE=InnoDB AUTO_INCREMENT=436 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `time_types`
--

DROP TABLE IF EXISTS `time_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `time_types` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `password` varchar(60) COLLATE utf8_unicode_ci NOT NULL,
  `remember_token` varchar(100) COLLATE utf8_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `updated_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  UNIQUE KEY `users_name_unique` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `variables`
--

DROP TABLE IF EXISTS `variables`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `variables` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `unit` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `fk_dst_id` int(10) unsigned NOT NULL,
  `sourceId` int(10) unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `updated_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `fk_var_type_id` int(10) unsigned NOT NULL,
  `uploaded_by` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `code` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `coverage` varchar(255) COLLATE utf8_unicode_ci NOT NULL DEFAULT '',
  `timespan` varchar(255) COLLATE utf8_unicode_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `variables_name_unique` (`name`,`fk_dst_id`),
  UNIQUE KEY `variables_code_unique` (`code`,`fk_dst_id`),
  KEY `variables_fk_dst_id_foreign` (`fk_dst_id`),
  KEY `variables_fk_dsr_id_foreign` (`sourceId`),
  KEY `variables_fk_var_type_id_foreign` (`fk_var_type_id`),
  KEY `variables_uploaded_by_foreign` (`uploaded_by`),
  CONSTRAINT `variables_fk_dst_id_foreign` FOREIGN KEY (`fk_dst_id`) REFERENCES `datasets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `variables_fk_var_type_id_foreign` FOREIGN KEY (`fk_var_type_id`) REFERENCES `variable_types` (`id`),
  CONSTRAINT `variables_sourceId_foreign` FOREIGN KEY (`sourceId`) REFERENCES `sources` (`id`),
  CONSTRAINT `variables_uploaded_by_foreign` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=1476 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2016-12-23 16:14:42
-- MySQL dump 10.13  Distrib 5.5.53, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: forge
-- ------------------------------------------------------
-- Server version	5.5.53-0ubuntu0.14.04.1-log

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `migrations` (
  `migration` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `batch` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations`
--

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES ('2014_10_12_000000_create_users_table',1),('2014_10_12_100000_create_password_resets_table',1),('2015_05_12_110710_create_datasources_table',1),('2015_05_12_111151_create_datasets_table',1),('2015_05_12_112101_create_variables_table',1),('2015_05_12_112553_create_entity_types_table',1),('2015_05_12_112708_create_entities_table',1),('2015_05_12_113004_create_times_table',1),('2015_05_12_113236_create_data_values_table',1),('2015_05_12_120607_create_dataset_categories_table',1),('2015_05_12_122255_create_entity_geometries_table',1),('2015_05_12_122529_create_entity_metas_table',1),('2015_05_12_153119_create_input_files_table',1),('2015_05_12_154846_create_variable_types_table',1),('2015_05_12_155811_create_entity_iso_names_table',1),('2015_05_14_111718_create_charts_table',1),('2015_05_18_110218_create_dataset_subcategories_table',1),('2015_05_18_110238_create_dataset_tags_table',1),('2015_05_18_110259_create_link_datasets_tags_table',1),('2015_05_26_172956_create_chart_types_table',1),('2015_05_26_173446_create_chart_type_dimensions_table',1),('2015_06_10_124347_create_time_types_table',1),('2016_02_22_140512_fix_graph_entity_refs',2),('2016_02_27_231151_map_time_ranges',3),('2016_03_03_052548_add_updated_by',4),('2016_03_03_234941_last_updated_at',5),('2016_03_04_013732_add_last_referer_url',5),('2016_03_04_045646_add_chart_notes',6),('2016_03_10_155541_add_chart_slug',7),('2016_03_15_205236_add_variable_uploaded_by',8),('2016_03_20_185023_add_variable_deletion_cascade',9),('2016_03_20_201729_add_dataset_deletion_cascade',9),('2016_03_22_025345_create_sessions_table',10),('2016_03_23_091915_move_times_to_data_values',11),('2016_03_23_105113_remove_input_files',11),('2016_03_29_105205_entity_uniqueness',12),('2016_03_29_130633_add_esteban_entities',13),('2016_03_29_132241_more_entity_uniqueness',14),('2016_03_29_161239_validate_esteban_entities',14),('2016_04_25_015146_referer_url_to_origin_url',15),('2016_05_01_094434_purge_empty_cells_from_database',16),('2016_06_05_223737_chart_slug_uniqueness',17),('2016_06_06_012112_chart_slug_redirects',17),('2016_06_06_013821_chart_slug_redirect_uniqueness',17),('2016_06_14_055451_data_value_uniqueness',18),('2016_06_27_094504_add_is_draft_to_chart',19),('2016_06_27_223542_unique_slug_only_if_published',19),('2016_06_28_235408_add_starred_to_charts',20),('2016_06_29_132727_unique_variable_name_in_dataset',21),('2016_07_05_132853_move_sources_from_datasets_to_variables',22),('2016_07_05_182612_dataset_created_at_auto',22),('2016_07_05_205450_remove_extraneous_fields_from_data_values',22),('2016_07_05_210355_remove_entity_type',22),('2016_07_11_002440_unique_category_names',23),('2016_07_11_020055_add_database_to_dataset',24),('2016_07_11_042116_add_code_to_variables',24),('2016_07_11_043456_unique_dataset_names',24),('2016_07_25_105321_chart_dimensions_destringify',25),('2016_07_25_123616_chart_dimensions_sql',25),('2016_07_25_202820_chart_type_enum',25),('2016_07_25_203455_chart_type_propagate_to_enum',25),('2016_07_27_195039_remove_countries_continents_dimensions',25),('2016_07_27_200416_change_chart_dimensions_unique_index',25),('2016_07_28_142948_redo_sources',25),('2016_07_28_144908_set_source_dataset_ids',25),('2016_07_28_153356_source_uniqueness_constriants',25),('2016_07_29_040257_variable_source_id',25),('2016_07_31_052313_add_coverage_and_timespan_to_variables',25),('2016_07_31_052418_pull_coverage_from_sources',25),('2016_07_31_095203_set_source_datasetid',25),('2016_08_05_021653_remove_chart_types_table',26),('2016_08_11_140652_targetYear_to_defaultYear',27),('2016_08_11_143521_targetProjection_to_defaultProjection',27),('2016_08_15_110911_clean_sources',28),('2016_08_15_180227_chart_dimensions_constraints',29),('2016_08_15_182025_chart_dimensions_constraints_2',29),('2016_09_21_105740_customNumericColors',30),('2016_09_26_175109_pull_link_and_retrieval_from_sources',31),('2016_09_26_203438_put_link_and_retrieval_back_on_sources',32),('2016_12_07_091044_remove_dimension_period',33),('2016_12_07_100046_maximum_age_to_tolerance',33),('2016_12_13_124244_nullable_targetYear',34),('2016_12_14_182137_svg_logos',35),('2016_12_14_191354_svg_logos2',35),('2016_12_14_193901_svg_logos3',35),('2016_12_16_204312_yaxis_min_0',36);
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2016-12-23 16:14:42
-- MySQL dump 10.13  Distrib 5.5.53, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: forge
-- ------------------------------------------------------
-- Server version	5.5.53-0ubuntu0.14.04.1-log

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `chart_types`
--

DROP TABLE IF EXISTS `chart_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chart_types` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chart_types`
--

LOCK TABLES `chart_types` WRITE;
/*!40000 ALTER TABLE `chart_types` DISABLE KEYS */;
INSERT INTO `chart_types` VALUES (1,'Line Chart'),(2,'Scatter Plot'),(3,'Stacked Area Chart'),(4,'Multi-Bar Chart'),(5,'Horizontal Multi-Bar Chart'),(6,'Discrete Bar Chart');
/*!40000 ALTER TABLE `chart_types` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2016-12-23 16:14:42
-- MySQL dump 10.13  Distrib 5.5.53, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: forge
-- ------------------------------------------------------
-- Server version	5.5.53-0ubuntu0.14.04.1-log

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `variable_types`
--

DROP TABLE IF EXISTS `variable_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `variable_types` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `isSortable` tinyint(1) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `variable_types`
--

LOCK TABLES `variable_types` WRITE;
/*!40000 ALTER TABLE `variable_types` DISABLE KEYS */;
INSERT INTO `variable_types` VALUES (1,'Nominal',0),(2,'Ordinal',1),(3,'Interval',1),(4,'Ratio',1);
/*!40000 ALTER TABLE `variable_types` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2016-12-23 16:14:42
INSERT INTO users (name, email, password) VALUES ('admin', 'admin@example.com', '$2y$10$T4Ye2Yce8GkRPpfCw8J0X.NwjHeu4FOLRMKVjAyT78cpU53YKyZSy');
