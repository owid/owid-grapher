-- MySQL dump 10.13  Distrib 5.5.47, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: forge
-- ------------------------------------------------------
-- Server version	5.5.47-0ubuntu0.14.04.1-log

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
  `targetYear` int(11) NOT NULL DEFAULT '2000',
  `tolerance` int(11) NOT NULL DEFAULT '5',
  `period` varchar(255) COLLATE utf8_unicode_ci NOT NULL DEFAULT 'single',
  `mode` varchar(255) COLLATE utf8_unicode_ci NOT NULL DEFAULT 'latest',
  `maximumAge` varchar(255) COLLATE utf8_unicode_ci NOT NULL DEFAULT '5',
  `color` varchar(255) COLLATE utf8_unicode_ci NOT NULL DEFAULT '',
  KEY `chart_dimensions_variableid_foreign` (`variableId`),
  KEY `chart_dimensions_chartid_foreign` (`chartId`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
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
) ENGINE=InnoDB AUTO_INCREMENT=300 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
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
) ENGINE=InnoDB AUTO_INCREMENT=3409565 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
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
) ENGINE=InnoDB AUTO_INCREMENT=286 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
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
  `url` varchar(100) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
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
-- Table structure for table `sources`
--

DROP TABLE IF EXISTS `sources`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sources` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `link` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `updated_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `datasetId` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`name`,`datasetId`)
) ENGINE=InnoDB AUTO_INCREMENT=291 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
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
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
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
) ENGINE=InnoDB AUTO_INCREMENT=1333 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2016-08-05 14:18:55
-- MySQL dump 10.13  Distrib 5.5.47, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: forge
-- ------------------------------------------------------
-- Server version	5.5.47-0ubuntu0.14.04.1-log

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
-- Dumping data for table `settings`
--

LOCK TABLES `settings` WRITE;
/*!40000 ALTER TABLE `settings` DISABLE KEYS */;
INSERT INTO `settings` VALUES (1,'sourceTemplate','<table>\r\n	<tr>\r\n		<td><span class=\"datasource-property\"><span class=\"datasource-property\">Data published by</span></td>\r\n		<td>Where did you find the data? e.g. World Bank WDI; or Toniolo and Vecchi (1998) ... </td>\r\n	</tr>\r\n	<tr>\r\n		<td><span class=\"datasource-property\">Data publisher\'s source</span></td>\r\n		<td>How was the data produced in the first place? E.g. Author(s) or original sources; Census Data...</td>\r\n	</tr>\r\n	<tr>\r\n		<td><span class=\"datasource-property\">Link</span></td>\r\n		<td><a href=\"http://www.com\">e.g. http://www.com</a></td>\r\n	</tr>\r\n	<tr>\r\n		<td><span class=\"datasource-property\">Retrieved</span></td>\r\n		<td>e.g. 18/08/2015</td>\r\n	</tr>\r\n</table>\r\n<div class=\"datasource-additional\">\r\n	<p>Any additional information should be placed here. In particular, details of any transformations made to produce the variable if it is not a direct download from the data provider.</p>\r\n</div>','0000-00-00 00:00:00','2016-08-01 13:10:21'),(2,'sourceTemplate','<table>\r\n	<tr>\r\n		<td><span class=\"datasource-property\"><span class=\"datasource-property\">Data provider</span></td>\r\n		<td>e.g. World Bank</td>\r\n	</tr>\r\n	<tr>\r\n		<td><span class=\"datasource-property\">Source</span></td>\r\n		<td>e.g. Author(s) or original sources</td>\r\n	</tr>\r\n	<tr>\r\n		<td><span class=\"datasource-property\">Description</span></td>\r\n		<td>e.g. Mean school years</td>\r\n	</tr>\r\n	<tr>\r\n		<td><span class=\"datasource-property\">Time span</span></td>\r\n		<td>e.g. 1970-2015</td>\r\n	</tr>\r\n	<tr>\r\n		<td><span class=\"datasource-property\">Geographic coverage</td>\r\n		<td>e.g. Global by country</td>\r\n	</tr>\r\n	<tr>\r\n		<td><span class=\"datasource-property\">Link</span></td>\r\n		<td><a href=\"http://www.com\">e.g. http://www.com</a></td>\r\n	</tr>\r\n	<tr>\r\n		<td><span class=\"datasource-property\">Retrieved</span></td>\r\n		<td>e.g. 18/08/2015</td>\r\n	</tr>\r\n</table>\r\n<div class=\"datasource-additional\">\r\n	<h3>Additional information</h3>\r\n	<p>e.g. Any additional information should be placed here. In particular, details of any transformations made to produce the variable if it is not a direct download from the data provider.</p>\r\n</div>','0000-00-00 00:00:00','0000-00-00 00:00:00');
/*!40000 ALTER TABLE `settings` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2016-08-05 14:18:55
-- MySQL dump 10.13  Distrib 5.5.47, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: forge
-- ------------------------------------------------------
-- Server version	5.5.47-0ubuntu0.14.04.1-log

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
INSERT INTO `migrations` VALUES ('2014_10_12_000000_create_users_table',1),('2014_10_12_100000_create_password_resets_table',1),('2015_05_12_110710_create_datasources_table',1),('2015_05_12_111151_create_datasets_table',1),('2015_05_12_112101_create_variables_table',1),('2015_05_12_112553_create_entity_types_table',1),('2015_05_12_112708_create_entities_table',1),('2015_05_12_113004_create_times_table',1),('2015_05_12_113236_create_data_values_table',1),('2015_05_12_120607_create_dataset_categories_table',1),('2015_05_12_122255_create_entity_geometries_table',1),('2015_05_12_122529_create_entity_metas_table',1),('2015_05_12_153119_create_input_files_table',1),('2015_05_12_154846_create_variable_types_table',1),('2015_05_12_155811_create_entity_iso_names_table',1),('2015_05_14_111718_create_charts_table',1),('2015_05_18_110218_create_dataset_subcategories_table',1),('2015_05_18_110238_create_dataset_tags_table',1),('2015_05_18_110259_create_link_datasets_tags_table',1),('2015_05_26_172956_create_chart_types_table',1),('2015_05_26_173446_create_chart_type_dimensions_table',1),('2015_06_10_124347_create_time_types_table',1),('2016_02_22_140512_fix_graph_entity_refs',2),('2016_02_27_231151_map_time_ranges',3),('2016_03_03_052548_add_updated_by',4),('2016_03_03_234941_last_updated_at',5),('2016_03_04_013732_add_last_referer_url',5),('2016_03_04_045646_add_chart_notes',6),('2016_03_10_155541_add_chart_slug',7),('2016_03_15_205236_add_variable_uploaded_by',8),('2016_03_20_185023_add_variable_deletion_cascade',9),('2016_03_20_201729_add_dataset_deletion_cascade',9),('2016_03_22_025345_create_sessions_table',10),('2016_03_23_091915_move_times_to_data_values',11),('2016_03_23_105113_remove_input_files',11),('2016_03_29_105205_entity_uniqueness',12),('2016_03_29_130633_add_esteban_entities',13),('2016_03_29_132241_more_entity_uniqueness',14),('2016_03_29_161239_validate_esteban_entities',14),('2016_04_25_015146_referer_url_to_origin_url',15),('2016_05_01_094434_purge_empty_cells_from_database',16),('2016_06_05_223737_chart_slug_uniqueness',17),('2016_06_06_012112_chart_slug_redirects',17),('2016_06_06_013821_chart_slug_redirect_uniqueness',17),('2016_06_14_055451_data_value_uniqueness',18),('2016_06_27_094504_add_is_draft_to_chart',19),('2016_06_27_223542_unique_slug_only_if_published',19),('2016_06_28_235408_add_starred_to_charts',20),('2016_06_29_132727_unique_variable_name_in_dataset',21),('2016_07_05_132853_move_sources_from_datasets_to_variables',22),('2016_07_05_182612_dataset_created_at_auto',22),('2016_07_05_205450_remove_extraneous_fields_from_data_values',22),('2016_07_05_210355_remove_entity_type',22),('2016_07_11_002440_unique_category_names',23),('2016_07_11_020055_add_database_to_dataset',24),('2016_07_11_042116_add_code_to_variables',24),('2016_07_11_043456_unique_dataset_names',24),('2016_07_25_105321_chart_dimensions_destringify',25),('2016_07_25_123616_chart_dimensions_sql',25),('2016_07_25_202820_chart_type_enum',25),('2016_07_25_203455_chart_type_propagate_to_enum',25),('2016_07_27_195039_remove_countries_continents_dimensions',25),('2016_07_27_200416_change_chart_dimensions_unique_index',25),('2016_07_28_142948_redo_sources',25),('2016_07_28_144908_set_source_dataset_ids',25),('2016_07_28_153356_source_uniqueness_constriants',25),('2016_07_29_040257_variable_source_id',25),('2016_07_31_052313_add_coverage_and_timespan_to_variables',25),('2016_07_31_052418_pull_coverage_from_sources',25),('2016_07_31_095203_set_source_datasetid',25),('2016_08_05_021653_remove_chart_types_table',26);
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

-- Dump completed on 2016-08-05 14:18:55
-- MySQL dump 10.13  Distrib 5.5.47, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: forge
-- ------------------------------------------------------
-- Server version	5.5.47-0ubuntu0.14.04.1-log

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

-- Dump completed on 2016-08-05 14:18:55
-- MySQL dump 10.13  Distrib 5.5.47, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: forge
-- ------------------------------------------------------
-- Server version	5.5.47-0ubuntu0.14.04.1-log

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
-- Dumping data for table `dataset_categories`
--

LOCK TABLES `dataset_categories` WRITE;
/*!40000 ALTER TABLE `dataset_categories` DISABLE KEYS */;
INSERT INTO `dataset_categories` VALUES (1,'Population Growth & Vital Statistics','0000-00-00 00:00:00','0000-00-00 00:00:00'),(2,'Health','0000-00-00 00:00:00','0000-00-00 00:00:00'),(3,'Food & Agriculture','0000-00-00 00:00:00','0000-00-00 00:00:00'),(4,'Resources & Energy','0000-00-00 00:00:00','0000-00-00 00:00:00'),(5,'Environmental Change','0000-00-00 00:00:00','0000-00-00 00:00:00'),(6,'Technology & Infrastructure','0000-00-00 00:00:00','0000-00-00 00:00:00'),(7,'Growth & Distribution of Prosperity','0000-00-00 00:00:00','0000-00-00 00:00:00'),(8,'Economic Development, Work & Standard of Living','0000-00-00 00:00:00','0000-00-00 00:00:00'),(9,'The Public Sector & Economic System','0000-00-00 00:00:00','0000-00-00 00:00:00'),(10,'Global Interconnections','0000-00-00 00:00:00','0000-00-00 00:00:00'),(11,'War & Peace','0000-00-00 00:00:00','0000-00-00 00:00:00'),(12,'Political Regime','0000-00-00 00:00:00','0000-00-00 00:00:00'),(13,'Violence & Rights','0000-00-00 00:00:00','0000-00-00 00:00:00'),(14,'Education & Knowledge','0000-00-00 00:00:00','0000-00-00 00:00:00'),(15,'Media & Communication','0000-00-00 00:00:00','0000-00-00 00:00:00'),(16,'Culture, Values & Society','0000-00-00 00:00:00','0000-00-00 00:00:00'),(17,'Abstract','0000-00-00 00:00:00','0000-00-00 00:00:00'),(18,'QoG Standard Dataset','0000-00-00 00:00:00','0000-00-00 00:00:00');
/*!40000 ALTER TABLE `dataset_categories` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2016-08-05 14:18:55
-- MySQL dump 10.13  Distrib 5.5.47, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: forge
-- ------------------------------------------------------
-- Server version	5.5.47-0ubuntu0.14.04.1-log

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
-- Dumping data for table `dataset_subcategories`
--

LOCK TABLES `dataset_subcategories` WRITE;
/*!40000 ALTER TABLE `dataset_subcategories` DISABLE KEYS */;
INSERT INTO `dataset_subcategories` VALUES (1,'World Population Growth',1,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(2,'Future World Population Growth',1,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(3,'Fertility Rates',1,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(4,'Age Structure and Mortality by Age',1,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(5,'Child Mortality',1,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(6,'Infant Mortality',1,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(7,'Life Expectancy',1,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(8,'Gender Ratio',1,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(9,'The Distribution of World Population',1,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(10,'Demographic Transition & Population Growth',1,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(11,'Eradication of Diseases',2,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(12,'Health Inequality',2,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(13,'HIV / AIDS',2,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(14,'Malaria',2,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(15,'Maternal Mortality',2,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(16,'Smoking',2,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(17,'Suicides',2,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(18,'Vaccination',2,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(19,'Cancer',2,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(20,'Epidemics',2,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(21,'Doctors & Health Workers',2,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(22,'Health Insurance & Spending',2,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(23,'Hygiene',2,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(24,'Causes of Death',2,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(25,'Burden of Disease',2,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(26,'Neglected Tropical Diseases',2,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(27,'Non-communicable Diseases',2,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(28,'Cardiovascular Diseases',2,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(29,'Disabilities & Chronic Diseases',2,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(30,'Tuberculosis',2,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(31,'Medical Research & Innovation',2,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(32,'Antibiotics',2,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(33,'Blood and Organ Donation',2,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(34,'Toxins',2,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(35,'Mental Health',2,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(36,'Food per Person',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(37,'Hunger & Undernourishment',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(38,'Famines',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(39,'Human Height',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(40,'Agricultural Employment',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(41,'Land Use in Agriculture',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(42,'Yields',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(43,'Fertilizer and Pesticides',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(44,'Food Prices',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(45,'Volatility of Food Prices',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(46,'Agricultural Output & Food Availability',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(47,'Productivity in Agriculture',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(48,'Improved Seeds & GMOs',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(49,'Farms & Agricultural Machinery',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(50,'Irrigation',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(51,'Soil Loss & Soil Quality',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(52,'Irrigation of Land',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(54,'Food Trade',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(55,'Agricultural Transition',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(56,'Food Origins',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(57,'Food Expenditure',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(58,'Diet Composition',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(59,'Agricultural Regulation',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(60,'Food Stocks',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(61,'Food Waste',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(62,'Obesity & BMI',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(63,'Impact of Climate Change on Food Supply',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(64,'Alcohol Consumption',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(65,'Marijuana & Other Drugs',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(66,'Productivity per Animal',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(67,'Meat Consumption & Livestock Counts',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(68,'Vegetarianism',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(69,'Seafood',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(70,'Non-food Crops',3,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(71,'CO2 and Greenhouse Gas Emissions',4,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(72,'Energy Production & Changing Energy Sources',4,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(73,'Energy Consumption',4,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(74,'Energy Efficiency',4,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(75,'Emission Intensity',4,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(76,'Electricity',4,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(77,'Energy Prices',4,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(78,'Energy Trade',4,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(79,'Safety of Different Energy Sources',4,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(80,'Nuclear Energy',4,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(81,'Renewable Energy',4,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(82,'Fossil Fuels',4,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(83,'Primary Good Economies & Resource Curse',4,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(84,'Resource Trade',4,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(85,'Oil Price, Taxes, Production & Consumption',4,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(86,'Non-Energy Resources',4,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(87,'Diamonds',4,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(88,'Forest Cover',5,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(89,'Indoor Air Pollution',5,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(90,'Land Cover',5,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(91,'Natural Catastrophes',5,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(92,'Oil Spills',5,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(93,'Climate Change',5,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(94,'Environmental Protection Efforts',5,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(95,'Public Opinion about Environment',5,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(96,'Natural Reserves & Parks',5,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(97,'Environment and Growth',5,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(98,'Environment and Institutions',5,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(99,'Biodiversity',5,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(100,'Extinction & Recovery of Animals',5,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(101,'Environment and Health',5,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(102,'Water Accessibility, Consumption & Sanitation',5,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(103,'Water Quality in Rivers and Oceans',5,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(104,'Acid Rain',5,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(105,'Ozone Layer',5,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(106,'Air Pollution',5,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(107,'Waste',5,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(108,'Past Climate Issues',5,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(109,'Carbon Stocks',5,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(110,'R&D, Engineers & Scientists',6,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(111,'Technological Progress',6,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(112,'Transportation Infrastructure',6,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(113,'Price and Speed of Transportation',6,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(114,'Space Travel & Satellites',6,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(115,'Patents & Innovation',6,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(116,'Quality of Technology',6,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(117,'Risk of Accidents',6,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(118,'Poison from Products',6,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(119,'Risk of Fire',6,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(120,'Chemicals Management & Catastrophes',6,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(121,'Dams & Reservoirs',6,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(122,'Technological Disasters',6,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(123,'Ancient Transport Infrastructure',6,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(124,'Vehicles, Public Transport & Street Lights',6,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(125,'Risk of Accidents in Transportation',6,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(126,'Goods Transportation',6,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(127,'Energy Demand for Transportation',6,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(128,'Incomes across the Income Distribution',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(129,'World Poverty',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(130,'GDP Growth Over the Last Centuries',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(131,'GDP Growth over the Very Long Run',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(132,'Economic Convergence between Countries',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(133,'Inequality between World Citizens',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(134,'GDP Data',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(135,'Income Inequality',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(136,'Economic Prosperity',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(137,'Predictions of Global Growth',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(138,'Wages & Other Measures of Income',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(139,'Price Data',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(140,'Inflation',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(141,'Economic Inequality',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(142,'Consumption Inequality',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(143,'Inequality of Wealth',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(144,'Income Mobility & Social Mobility',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(145,'Relative Poverty',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(146,'Minimum Wage',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(147,'Economic Gender & Race Differences',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(148,'Poverty in Individual Countries',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(149,'Middle Class',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(150,'Factor Incomes',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(151,'Finance & Stocks',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(152,'Banks & Financial Institutions',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(153,'Finance & Business Education',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(154,'Business Cycles, Crises & Recessions',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(155,'Financial Stability',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(156,'Interest Rates & Credit Market',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(157,'Corporate Profits',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(158,'Consumer Credit, Debt & Saving',7,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(159,'Happiness and Life Satisfaction',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(160,'Human Development Index (HDI)',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(161,'Light',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(162,'Trends in Africa',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(163,'Working Hours',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(164,'Slavery',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(165,'Productivity of Technologies',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(166,'Efficiency and Growth',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(167,'Industrialization & Technological Progress',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(168,'Capital Formation & Investment',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(169,'Capital per Worker',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(170,'Multidimensional Poverty',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(171,'Quality of Life & Standard of Living',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(172,'Global Convergence of Quality of Life',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(173,'Consumption Basket',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(174,'Goods',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(175,'Urbanization',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(176,'Quality of Life in Urban and Rural Areas',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(177,'Housing',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(178,'House Size',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(179,'Toilets',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(180,'Homelessness',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(181,'Working Time over Life',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(182,'Job Satisfaction',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(183,'Work Conditions & Safety',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(184,'Workers’ Unions',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(185,'Workers Rights',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(186,'Child Labor',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(187,'Risk',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(188,'Strikes & Industrial Disputes',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(189,'Servants',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(190,'Forced Labor',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(191,'Unofficial Economy',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(192,'Labor Force Participation',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(193,'Start-Ups & Entrepreneurialism',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(194,'Unemployment',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(195,'Labor Market Policy',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(196,'Unpaid Work',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(197,'Non-Profit Sector',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(198,'Corruption',8,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(199,'Social Spending',9,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(200,'Public Sector Employment',9,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(201,'Government Revenue',9,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(202,'Composition of Tax Revenues',9,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(203,'Corporate Tax',9,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(204,'Other Taxes',9,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(205,'Income Tax & Redistribution',9,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(206,'Public Spending',9,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(207,'Monetary Policy',9,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(208,'Pension System & Incomes of the Elderly',9,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(209,'Public Debt & Government Bonds',9,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(210,'Views on Capitalism',9,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(211,'Economic Systems',9,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(212,'Competition',9,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(213,'Economic Freedom & Regulation',9,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(214,'Business Environment',9,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(215,'Property Rights',9,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(216,'Intellectual Property',9,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(217,'International Trade',10,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(218,'Tariffs, Financial Liberalization & Trade Barriers',10,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(219,'Economic Openness',10,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(220,'Balance of Payment, Current Account and Capital Account',10,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(221,'Foreign Direct Investment & Capital Flows',10,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(222,'Trade from Antiquity to Early Modern Times',10,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(223,'Trade from the Recent Past to Present',10,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(224,'Trade Composition',10,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(225,'Economic Unions & Trade Agreements',10,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(226,'State Unions',10,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(227,'Intergovernmental Organizations & Diplomacy',10,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(228,'Terms of Trade',10,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(229,'Foreign Aid',10,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(230,'Trends for the Bottom Billion',10,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(231,'Traveling & Tourism',10,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(232,'Remittances',10,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(233,'Migration',10,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(234,'Public Opinion on Immigration',10,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(235,'Domestic Migration',10,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(236,'Education & Migration',10,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(237,'Human Trafficking',10,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(238,'Political Asylum & Refugees',10,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(239,'Civil Wars',11,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(240,'Genocides',11,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(241,'Military Spending',11,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(242,'Nuclear Weapons',11,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(243,'Peacekeeping',11,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(244,'Terrorism',11,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(245,'War and Peace before 1945',11,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(246,'War and Peace after 1945',11,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(247,'Correlates & Drivers of Peace',11,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(248,'Military Personnel',11,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(249,'Fortifications of Settlements',11,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(250,'Wars in Non-State Societies',11,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(251,'Arms Producers, Trade & Non-Proliferation',11,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(252,'Landmines and Other Weapons',11,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(253,'Consequences of Conflict',11,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(254,'Costs of Wars',11,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(255,'Democratisation',12,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(256,'Accountability & Transparency',12,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(257,'State Violence – Judicial Torture & Capital Punishment',12,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(258,'Political Regimes in the Long Run',12,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(259,'Political Rights',12,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(260,'Citizenship',12,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(261,'Democratic Values of the People',12,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(262,'Trust in Political Regime & Institutions',12,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(263,'Franchise, Voting Rights & Electoral Systems',12,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(264,'Voter Turnout',12,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(265,'Political Engagement & Protest',12,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(266,'Separation of State and Religion',12,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(267,'Political Stability & Coups',12,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(268,'Violence against the Political System',12,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(269,'Gender Differences in Politics',12,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(270,'Protests',12,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(271,'Rule of Law',12,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(272,'Colonialism & Imperialism',12,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(273,'Prisons & Police',12,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(274,'Privacy & Surveillance',12,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(275,'Political Fragmentation, Segregation & Centralization',12,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(276,'Freedom of Press & Speech',12,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(277,'Cascade of Rights',13,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(278,'Ethnographic and Archaeological Evidence on Violent Deaths',13,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(279,'Homicides',13,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(280,'Treatment of Minorities – Violence and Tolerance',13,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(281,'Quality of Institutions',13,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(282,'Women’s Rights and Violence against Women',13,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(283,'Guns',13,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(284,'Crime & Violence',13,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(285,'Human Rights',13,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(286,'Religious Violence & Tolerance',13,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(287,'Genital Mutilation',13,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(288,'Female Infanticide & Gender Ratios',13,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(289,'Violence against & Rights for Children',13,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(290,'Violence against & Rights for LGBTQ People',13,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(291,'Violence against & Rights for Animals',13,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(292,'Treatment of the Elderly',13,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(293,'Financing of Education',14,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(294,'Global Rise of Education',14,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(295,'Higher Education',14,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(296,'Intelligence',14,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(297,'International Research Community',14,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(298,'Primary Education and Schools',14,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(299,'Projections of Future Education',14,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(300,'Quality of Education & Drop-Out Rates',14,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(301,'Skill Premium – Income by Education',14,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(302,'Literacy',14,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(303,'Secondary Education',14,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(304,'Numeracy',14,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(305,'Pre-Primary Education',14,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(306,'Lifelong Education',14,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(307,'Teachers & Professors',14,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(308,'Education Mobility',14,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(309,'Time Spent studying',14,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(310,'Inequality of Education',14,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(311,'Internationalizing Education',14,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(312,'Open Data',14,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(313,'Books',15,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(314,'Internet',15,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(315,'Social Media',15,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(316,'Cultural Institutions',15,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(317,'News & Public Media',15,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(318,'Reporting of the Media',15,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(319,'Radio, TV & Movies',15,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(320,'Music',15,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(321,'Communication Technology & Mobile Phone',15,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(322,'Materialism and Post-Materialism',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(323,'Optimism & Pessimism',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(324,'Trust',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(325,'Marriage & Relationships',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(326,'Teenage Pregnancy & Marriage',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(327,'Self Expression & Secular Rationalism',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(328,'Life Goals',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(329,'Live Values',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(330,'Demand for Rights & Liberty',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(331,'Freedom vs Egality',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(332,'Rational Orientation',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(333,'Individualism',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(334,'We-Feeling, Nationalism & Cosmopolitanism',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(335,'Emotionalism vs Stoicism',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(336,'Individualism vs Collectivism',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(337,'Egalitarianism vs Elitism',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(338,'Value Determinants',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(339,'Views on Tradition and Modernization',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(340,'Quantitative View of the World',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(341,'Conservatism vs Liberalism',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(342,'Long-Term Determinants of Values',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(343,'Variety',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(344,'Fashion & Style',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(345,'Beauty',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(346,'Art',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(347,'Cultural Contact & Transferring',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(348,'World Languages',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(349,'Foreign Language Skills',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(350,'Sports',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(351,'Religion',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(352,'Atheism',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(353,'Contraception & Abortion',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(354,'Sex',16,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(355,'Geographic',17,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(356,'Identification Variables',18,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(357,'Health',18,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(358,'Education',18,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(359,'Civil Society',18,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(360,'Conflict/Violence',18,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(361,'Election',18,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(362,'Energy and Infrastructure',18,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(363,'Environment',18,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(364,'Political System',18,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(365,'Judicial',18,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(366,'Quality of Government',18,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(367,'Migration',18,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(368,'Media',18,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(369,'Welfare',18,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(370,'Public Economy',18,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(371,'Private Economy',18,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(372,'Labour Market',18,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(373,'Religion',18,'0000-00-00 00:00:00','0000-00-00 00:00:00'),(374,'History',18,'0000-00-00 00:00:00','0000-00-00 00:00:00');
/*!40000 ALTER TABLE `dataset_subcategories` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2016-08-05 14:18:55
-- MySQL dump 10.13  Distrib 5.5.47, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: forge
-- ------------------------------------------------------
-- Server version	5.5.47-0ubuntu0.14.04.1-log

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
) ENGINE=InnoDB AUTO_INCREMENT=5068 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `entities`
--
-- WHERE:  validated IS TRUE

LOCK TABLES `entities` WRITE;
/*!40000 ALTER TABLE `entities` DISABLE KEYS */;
INSERT INTO `entities` VALUES (1,'GBR','United Kingdom',1,'2015-06-12 16:13:16','2015-06-30 08:06:49'),(2,'IRL','Ireland',1,'2015-06-15 12:14:32','2015-06-30 08:06:49'),(3,'FRA','France',1,'2015-06-15 12:14:32','2015-06-27 19:35:46'),(4,'BEL','Belgium',1,'2015-06-15 12:14:32','2015-06-30 08:06:48'),(5,'NLD','Netherlands',1,'2015-06-15 12:14:32','2015-06-30 08:06:49'),(6,'DEU','Germany',1,'2015-06-15 12:14:32','2015-06-27 19:35:46'),(7,'CHE','Switzerland',1,'2015-06-15 12:14:32','2015-06-27 19:35:47'),(8,'ITA','Italy',1,'2015-06-15 12:14:32','2015-06-30 08:06:49'),(9,'ESP','Spain',1,'2015-06-15 12:14:32','2015-06-30 08:06:49'),(10,'SWE','Sweden',1,'2015-06-15 12:14:32','2015-06-30 08:06:49'),(11,'POL','Poland',1,'2015-06-15 12:14:32','2015-06-30 08:06:49'),(12,'RUS','Russia',1,'2015-06-15 12:14:32','2015-06-30 08:06:49'),(13,'USA','United States',1,'2015-06-16 07:34:40','2015-06-27 19:35:46'),(14,'JPN','Japan',1,'2015-06-16 07:34:41','2015-06-27 19:35:47'),(15,'AFG','Afghanistan',1,'2015-06-16 08:31:11','2015-06-30 08:06:47'),(16,'ALB','Albania',1,'2015-06-16 08:31:11','2015-06-30 08:06:47'),(17,'DZA','Algeria',1,'2015-06-16 08:31:11','2015-06-30 08:06:47'),(18,'AND','Andorra',1,'2015-06-16 08:31:11','2015-06-30 08:06:47'),(19,'AGO','Angola',1,'2015-06-16 08:31:11','2015-06-30 08:06:47'),(20,'ATG','Antigua and Barbuda',1,'2015-06-16 08:31:12','2015-06-30 08:06:47'),(21,'ARG','Argentina',1,'2015-06-16 08:31:12','2015-06-30 08:06:48'),(22,'ARM','Armenia',1,'2015-06-16 08:31:12','2015-06-30 08:06:48'),(23,'AUS','Australia',1,'2015-06-16 08:31:12','2015-06-30 08:06:48'),(24,'AUT','Austria',1,'2015-06-16 08:31:12','2015-06-30 08:06:48'),(25,'AZE','Azerbaijan',1,'2015-06-16 08:31:12','2015-06-30 08:06:48'),(26,'BHS','Bahamas',1,'2015-06-16 08:31:12','2015-06-30 08:06:48'),(27,'BHR','Bahrain',1,'2015-06-16 08:31:13','2015-06-30 08:06:48'),(28,'BGD','Bangladesh',1,'2015-06-16 08:31:13','2015-06-30 08:06:48'),(29,'BRB','Barbados',1,'2015-06-16 08:31:13','2015-06-30 08:06:48'),(30,'BLR','Belarus',1,'2015-06-16 08:31:13','2015-06-30 08:06:48'),(31,'BLZ','Belize',1,'2015-06-16 08:31:13','2015-06-30 08:06:48'),(32,'BEN','Benin',1,'2015-06-16 08:31:13','2015-06-30 08:06:48'),(33,'BTN','Bhutan',1,'2015-06-16 08:31:13','2015-06-30 08:06:48'),(34,'BOL','Bolivia',1,'2015-06-16 08:31:13','2015-06-30 08:06:48'),(35,'BIH','Bosnia and Herzegovina',1,'2015-06-16 08:31:13','2015-06-30 08:06:48'),(36,'BWA','Botswana',1,'2015-06-16 08:31:13','2015-06-30 08:06:48'),(37,'BRA','Brazil',1,'2015-06-16 08:31:13','2015-06-30 08:06:48'),(38,'BRN','Brunei',1,'2015-06-16 08:31:13','2015-06-30 08:06:48'),(39,'BGR','Bulgaria',1,'2015-06-16 08:31:13','2015-06-30 08:06:48'),(40,'BFA','Burkina Faso',1,'2015-06-16 08:31:14','2015-06-30 08:06:48'),(41,'BDI','Burundi',1,'2015-06-16 08:31:14','2015-06-30 08:06:48'),(42,'KHM','Cambodia',1,'2015-06-16 08:31:14','2015-06-30 08:06:48'),(43,'CMR','Cameroon',1,'2015-06-16 08:31:14','2015-06-30 08:06:48'),(44,'CAN','Canada',1,'2015-06-16 08:31:14','2015-06-30 08:06:48'),(45,'CPV','Cape Verde',1,'2015-06-16 08:31:14','2015-06-30 08:06:48'),(60,'ZMB','Zambia',1,'2015-07-01 13:53:20','2015-07-01 13:53:20'),(61,'YEM','Yemen',1,'2015-07-01 13:53:20','2015-07-01 13:53:20'),(62,'UZB','Uzbekistan',1,'2015-07-01 13:53:20','2015-07-01 13:53:20'),(63,'URY','Uruguay',1,'2015-07-01 13:53:20','2015-07-01 13:53:20'),(64,'TZA','Tanzania',1,'2015-07-01 13:53:20','2015-07-01 13:53:20'),(65,'EGY','Egypt',1,'2015-07-01 13:53:20','2015-07-01 13:53:20'),(66,'MKD','Macedonia',1,'2015-07-01 13:53:20','2015-07-01 13:53:20'),(67,'UKR','Ukraine',1,'2015-07-01 13:53:20','2015-07-01 13:53:20'),(68,'UGA','Uganda',1,'2015-07-01 13:53:20','2015-07-01 13:53:20'),(69,'TKM','Turkmenistan',1,'2015-07-01 13:53:20','2015-07-01 13:53:20'),(70,'TUR','Turkey',1,'2015-07-01 13:53:20','2015-07-01 13:53:20'),(71,'TUN','Tunisia',1,'2015-07-01 13:53:20','2015-07-01 13:53:20'),(72,'ARE','United Arab Emirates',1,'2015-07-01 13:53:20','2015-07-01 13:53:20'),(73,'TTO','Trinidad and Tobago',1,'2015-07-01 13:53:20','2015-07-01 13:53:20'),(74,'TGO','Togo',1,'2015-07-01 13:53:20','2015-07-01 13:53:20'),(75,'THA','Thailand',1,'2015-07-01 13:53:20','2015-07-01 13:53:20'),(76,'TJK','Tajikistan',1,'2015-07-01 13:53:20','2015-07-01 13:53:20'),(77,'SYR','Syria',1,'2015-07-01 13:53:20','2015-07-01 13:53:20'),(78,'SWZ','Swaziland',1,'2015-07-01 13:53:20','2015-07-01 13:53:20'),(79,'SDN','Sudan',1,'2015-07-01 13:53:20','2015-07-01 13:53:20'),(80,'ZWE','Zimbabwe',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(81,'ZAF','South Africa',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(82,'SOM','Somalia',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(83,'SVN','Slovenia',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(84,'VNM','Vietnam',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(85,'SVK','Slovakia',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(86,'SGP','Singapore',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(87,'SLE','Sierra Leone',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(88,'SRB','Serbia',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(89,'SEN','Senegal',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(90,'SAU','Saudi Arabia',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(91,'RWA','Rwanda',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(92,'ROU','Romania',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(93,'PRI','Puerto Rico',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(94,'GNB','Guinea-Bissau',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(95,'PRT','Portugal',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(96,'PHL','Philippines',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(97,'PER','Peru',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(98,'PRY','Paraguay',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(99,'PNG','Papua New Guinea',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(100,'PAN','Panama',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(101,'PAK','Pakistan',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(102,'NOR','Norway',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(103,'NGA','Nigeria',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(104,'NER','Niger',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(105,'NIC','Nicaragua',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(106,'NZL','New Zealand',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(107,'NPL','Nepal',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(108,'NAM','Namibia',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(109,'MOZ','Mozambique',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(110,'MAR','Morocco',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(111,'MDA','Moldova',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(112,'MNG','Mongolia',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(113,'MEX','Mexico',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(114,'MRT','Mauritania',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(115,'MLI','Mali',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(116,'MYS','Malaysia',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(117,'MWI','Malawi',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(118,'MDG','Madagascar',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(119,'LTU','Lithuania',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(120,'LBY','Libya',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(121,'LBR','Liberia',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(122,'LVA','Latvia',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(123,'LSO','Lesotho',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(124,'LBN','Lebanon',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(125,'LAO','Laos',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(126,'KGZ','Kyrgyzstan',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(127,'KOR','South Korea',1,'2015-07-01 13:53:21','2015-07-01 13:53:21'),(128,'PRK','North Korea',1,'2015-07-01 13:53:22','2015-07-01 13:53:22'),(129,'KEN','Kenya',1,'2015-07-01 13:53:22','2015-07-01 13:53:22'),(130,'JOR','Jordan',1,'2015-07-01 13:53:22','2015-07-01 13:53:22'),(131,'KAZ','Kazakhstan',1,'2015-07-01 13:53:22','2015-07-01 13:53:22'),(132,'JAM','Jamaica',1,'2015-07-01 13:53:22','2015-07-01 13:53:22'),(133,'ISR','Israel',1,'2015-07-01 13:53:22','2015-07-01 13:53:22'),(134,'IRQ','Iraq',1,'2015-07-01 13:53:22','2015-07-01 13:53:22'),(135,'IRN','Iran',1,'2015-07-01 13:53:22','2015-07-01 13:53:22'),(136,'IDN','Indonesia',1,'2015-07-01 13:53:22','2015-07-01 13:53:22'),(137,'IND','India',1,'2015-07-01 13:53:22','2015-07-01 13:53:22'),(138,'HUN','Hungary',1,'2015-07-01 13:53:22','2015-07-01 13:53:22'),(139,'HND','Honduras',1,'2015-07-01 13:53:22','2015-07-01 13:53:22'),(140,'PSE','Palestine',1,'2015-07-01 13:53:22','2015-07-01 13:53:22'),(141,'LKA','Sri Lanka',1,'2015-07-01 13:53:22','2015-07-01 13:53:22'),(142,'MMR','Myanmar',1,'2015-07-01 13:53:22','2015-07-01 13:53:22'),(143,'CIV','Cote d\'Ivoire',1,'2015-07-02 06:55:55','2015-07-02 06:55:55'),(144,'HKG','Hong Kong',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(145,'HTI','Haiti',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(146,'GUY','Guyana',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(147,'GIN','Guinea',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(148,'GTM','Guatemala',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(149,'GRC','Greece',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(150,'GHA','Ghana',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(151,'GMB','Gambia',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(152,'GEO','Georgia',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(153,'GAB','Gabon',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(154,'DJI','Djibouti',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(155,'FIN','Finland',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(156,'EST','Estonia',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(157,'ERI','Eritrea',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(158,'ETH','Ethiopia',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(159,'GNQ','Equatorial Guinea',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(160,'DOM','Dominican Republic',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(161,'DNK','Denmark',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(162,'CZE','Czech Republic',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(163,'CYP','Cyprus',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(164,'CUB','Cuba',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(165,'HRV','Croatia',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(166,'CRI','Costa Rica',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(167,'COD','Democratic Republic of Congo',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(168,'COG','Congo',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(169,'COM','Comoros',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(170,'COL','Colombia',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(171,'CHN','China',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(172,'CHL','Chile',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(173,'TCD','Chad',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(174,'CAF','Central African Republic',1,'2015-07-02 06:55:56','2015-07-02 06:55:56'),(185,'OWID_GFR','West Germany',1,'2015-07-06 14:42:41','2015-07-06 14:42:41'),(186,'OWID_GDR','East Germany',1,'2015-07-06 14:42:41','2015-07-06 14:42:41'),(193,'MYT','Mayotte',1,'2015-07-07 06:41:57','2015-07-07 06:41:57'),(194,'BMU','Bermuda',1,'2015-07-07 17:09:01','2015-07-07 17:09:01'),(195,'SLB','Solomon Islands',1,'2015-07-07 17:09:02','2015-07-07 17:09:02'),(196,'VGB','British Virgin Islands',1,'2015-07-07 17:09:02','2015-07-07 17:09:02'),(197,'CYM','Cayman Islands',1,'2015-07-07 17:09:02','2015-07-07 17:09:02'),(198,'TWN','Taiwan',1,'2015-07-07 17:09:02','2015-07-07 17:09:02'),(199,'COK','Cook Islands',1,'2015-07-07 17:09:03','2015-07-07 17:09:03'),(200,'DMA','Dominica',1,'2015-07-07 17:09:03','2015-07-07 17:09:03'),(201,'ECU','Ecuador',1,'2015-07-07 17:09:03','2015-07-07 17:09:03'),(202,'FJI','Fiji',1,'2015-07-07 17:09:03','2015-07-07 17:09:03'),(203,'PYF','French Polynesia',1,'2015-07-07 17:09:04','2015-07-07 17:09:04'),(204,'KIR','Kiribati',1,'2015-07-07 17:09:04','2015-07-07 17:09:04'),(205,'GRL','Greenland',1,'2015-07-07 17:09:04','2015-07-07 17:09:04'),(206,'GRD','Grenada',1,'2015-07-07 17:09:04','2015-07-07 17:09:04'),(207,'ISL','Iceland',1,'2015-07-07 17:09:04','2015-07-07 17:09:04'),(208,'KWT','Kuwait',1,'2015-07-07 17:09:05','2015-07-07 17:09:05'),(209,'LIE','Liechtenstein',1,'2015-07-07 17:09:06','2015-07-07 17:09:06'),(210,'LUX','Luxembourg',1,'2015-07-07 17:09:06','2015-07-07 17:09:06'),(211,'MDV','Maldives',1,'2015-07-07 17:09:06','2015-07-07 17:09:06'),(212,'MLT','Malta',1,'2015-07-07 17:09:06','2015-07-07 17:09:06'),(213,'MUS','Mauritius',1,'2015-07-07 17:09:06','2015-07-07 17:09:06'),(214,'MCO','Monaco',1,'2015-07-07 17:09:06','2015-07-07 17:09:06'),(215,'MNE','Montenegro',1,'2015-07-07 17:09:06','2015-07-07 17:09:06'),(216,'MSR','Montserrat',1,'2015-07-07 17:09:06','2015-07-07 17:09:06'),(217,'OMN','Oman',1,'2015-07-07 17:09:07','2015-07-07 17:09:07'),(218,'NRU','Nauru',1,'2015-07-07 17:09:07','2015-07-07 17:09:07'),(219,'ABW','Aruba',1,'2015-07-07 17:09:07','2015-07-07 17:09:07'),(220,'NCL','New Caledonia',1,'2015-07-07 17:09:07','2015-07-07 17:09:07'),(221,'VUT','Vanuatu',1,'2015-07-07 17:09:07','2015-07-07 17:09:07'),(222,'FSM','Micronesia',1,'2015-07-07 17:09:07','2015-07-07 17:09:07'),(223,'MHL','Marshall Islands',1,'2015-07-07 17:09:07','2015-07-07 17:09:07'),(224,'PLW','Palau',1,'2015-07-07 17:09:07','2015-07-07 17:09:07'),(225,'TLS','Timor',1,'2015-07-07 17:09:08','2015-07-07 17:09:08'),(226,'QAT','Qatar',1,'2015-07-07 17:09:08','2015-07-07 17:09:08'),(227,'KNA','Saint Kitts and Nevis',1,'2015-07-07 17:09:08','2015-07-07 17:09:08'),(228,'AIA','Anguilla',1,'2015-07-07 17:09:08','2015-07-07 17:09:08'),(229,'LCA','Saint Lucia',1,'2015-07-07 17:09:08','2015-07-07 17:09:08'),(230,'VCT','Saint Vincent and the Grenadines',1,'2015-07-07 17:09:08','2015-07-07 17:09:08'),(231,'SMR','San Marino',1,'2015-07-07 17:09:08','2015-07-07 17:09:08'),(232,'STP','Sao Tome and Principe',1,'2015-07-07 17:09:08','2015-07-07 17:09:08'),(233,'SYC','Seychelles',1,'2015-07-07 17:09:08','2015-07-07 17:09:08'),(234,'SUR','Suriname',1,'2015-07-07 17:09:09','2015-07-07 17:09:09'),(235,'TON','Tonga',1,'2015-07-07 17:09:09','2015-07-07 17:09:09'),(236,'TCA','Turks and Caicos Islands',1,'2015-07-07 17:09:10','2015-07-07 17:09:10'),(237,'TUV','Tuvalu',1,'2015-07-07 17:09:10','2015-07-07 17:09:10'),(238,'VEN','Venezuela',1,'2015-07-07 17:09:10','2015-07-07 17:09:10'),(239,'WSM','Samoa',1,'2015-07-07 17:09:10','2015-07-07 17:09:10'),(245,'REU','Reunion',1,'2015-07-09 19:41:34','2015-07-09 19:41:34'),(246,'ASM','American Samoa',1,'2015-07-14 05:12:37','2015-07-14 05:12:37'),(247,'CXR','Christmas Island',1,'2015-07-14 05:12:44','2015-07-14 05:12:44'),(248,'ESH','Western Sahara',1,'2015-07-14 05:12:46','2015-07-14 05:12:46'),(249,'FLK','Falkland Islands',1,'2015-07-14 05:12:47','2015-07-14 05:12:47'),(250,'FRO','Faeroe Islands',1,'2015-07-14 05:12:47','2015-07-14 05:12:47'),(251,'GIB','Gibraltar',1,'2015-07-14 05:12:48','2015-07-14 05:12:48'),(252,'GLP','Guadeloupe',1,'2015-07-14 05:12:48','2015-07-14 05:12:48'),(253,'GUF','French Guiana',1,'2015-07-14 05:12:50','2015-07-14 05:12:50'),(254,'GUM','Guam',1,'2015-07-14 05:12:50','2015-07-14 05:12:50'),(255,'WLF','Wallis and Futuna',1,'2015-07-14 16:21:59','2015-07-14 16:21:59'),(256,'VIR','United States Virgin Islands',1,'2015-07-14 16:22:00','2015-07-14 16:22:00'),(257,'VAT','Vatican',1,'2015-07-14 16:22:00','2015-07-14 16:22:00'),(258,'SSD','South Sudan',1,'2015-07-14 16:22:01','2015-07-14 16:22:01'),(259,'SLV','El Salvador',1,'2015-07-14 16:22:01','2015-07-14 16:22:01'),(260,'SHN','Saint Helena',1,'2015-07-14 16:22:01','2015-07-14 16:22:01'),(261,'NIU','Niue',1,'2015-07-14 16:22:03','2015-07-14 16:22:03'),(262,'MAC','Macao',1,'2015-07-14 16:22:04','2015-07-14 16:22:04'),(263,'CCK','Cocos Islands',1,'2015-07-14 16:22:06','2015-07-14 16:22:06'),(265,'IMN','Isle of Man',1,'2015-07-15 22:38:31','2015-07-15 22:38:31'),(266,'MNP','Northern Mariana Islands',1,'2015-07-15 22:38:32','2015-07-15 22:38:32'),(267,'OWID_CZS','Czechoslovakia',1,'2015-07-16 01:51:34','2015-07-16 01:51:34'),(268,'OWID_SRM','Serbia and Montenegro',1,'2015-07-16 01:51:35','2015-07-16 01:51:35'),(270,'OWID_USS','USSR',1,'2015-07-16 01:51:36','2015-07-16 01:51:36'),(271,'OWID_YGS','Yugoslavia',1,'2015-07-16 01:51:36','2015-07-16 01:51:36'),(279,'CUW','Curacao',1,'2015-07-20 16:29:11','2015-07-20 16:29:11'),(280,'MAF','Saint Martin (French part)',1,'2015-07-20 16:29:15','2015-07-20 16:29:15'),(281,'SXM','Sint Maarten (Dutch part)',1,'2015-07-20 16:29:17','2015-07-20 16:29:17'),(282,'GGY','Guernsey',1,'2015-07-21 21:11:56','2015-07-21 21:11:56'),(283,'JEY','Jersey',1,'2015-07-21 21:11:56','2015-07-21 21:11:56'),(284,'MTQ','Martinique',1,'2015-07-21 21:11:56','2015-07-21 21:11:56'),(285,'NFK','Norfolk Island',1,'2015-07-21 21:11:56','2015-07-21 21:11:56'),(286,'PCN','Pitcairn',1,'2015-07-21 21:11:56','2015-07-21 21:11:56'),(287,'TKL','Tokelau',1,'2015-07-21 21:11:56','2015-07-21 21:11:56'),(296,'ALA','Åland Islands',1,'2015-07-28 02:30:13','2015-07-28 02:30:13'),(297,'BLM','Saint Barthélemy',1,'2015-07-28 02:30:16','2015-07-28 02:30:16'),(298,'SJM','Svalbard and Jan Mayen',1,'2015-07-28 02:30:40','2015-07-28 02:30:40'),(304,'OWID_CIS','Channel Islands',1,'2015-07-31 04:46:31','2015-07-31 04:46:31'),(346,'ATA','Antarctica',1,'2015-08-06 16:01:28','2015-08-06 16:01:28'),(347,'ATF','French Southern Territories',1,'2015-08-06 16:01:28','2015-08-06 16:01:28'),(348,'BES','Bonaire Sint Eustatius and Saba',1,'2015-08-06 16:01:28','2015-08-06 16:01:28'),(349,'BVT','Bouvet Island',1,'2015-08-06 16:01:29','2015-08-06 16:01:29'),(350,'HMD','Heard Island and McDonald Islands',1,'2015-08-06 16:01:32','2015-08-06 16:01:32'),(351,'IOT','British Indian Ocean Territory',1,'2015-08-06 16:01:33','2015-08-06 16:01:33'),(352,'SGS','South Georgia and the South Sandwich Islands',1,'2015-08-06 16:01:39','2015-08-06 16:01:39'),(353,'SPM','Saint Pierre and Miquelon',1,'2015-08-06 16:01:39','2015-08-06 16:01:39'),(354,'UMI','United States Minor Outlying Islands',1,'2015-08-06 16:01:41','2015-08-06 16:01:41'),(355,'OWID_WRL','World',1,'2015-08-06 21:54:47','2015-08-06 21:54:47'),(362,'ANT','Netherlands Antilles',1,'2015-08-19 00:09:40','2015-08-19 00:09:40'),(363,'OWID_HAN','Hanover',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(364,'OWID_BAV','Bavaria',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(367,'OWID_BAD','Baden',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(368,'OWID_SAX','Saxony',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(369,'OWID_WRT','Wuerttemburg',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(370,'OWID_HSE','Hesse Electoral',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(371,'OWID_HSG','Hesse Grand Ducal',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(372,'OWID_MEC','Mecklenburg Schwerin',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(373,'OWID_AUH','Austria-Hungary',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(375,'OWID_SIC','Two Sicilies',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(376,'OWID_MOD','Modena',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(377,'OWID_PMA','Parma',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(378,'OWID_TUS','Tuscany',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(379,'OWID_KOS','Kosovo',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(380,'OWID_ZAN','Zanzibar',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(381,'OWID_YAR','Yemen Arab Republic',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(382,'OWID_YPR','Yemen People\'s Republic',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(383,'OWID_KRU','United Korea',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(384,'OWID_RVN','Republic of Vietnam',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(386,'OWID_ABK','Abkhazia',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(387,'OWID_AKD','Akrotiri and Dhekelia',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(388,'OWID_ERE','Eritrea and Ethiopia',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(389,'OWID_NAG','Nagorno-Karabakh',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(390,'OWID_CYN','Northern Cyprus',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(392,'OWID_SEK','Serbia excluding Kosovo',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(393,'OWID_SML','Somaliland',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(394,'OWID_SOS','South Ossetia',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(395,'OWID_TRS','Transnistria',1,'2015-08-19 00:09:42','2015-08-19 00:09:42'),(478,'OWID_MNS','Melanesia',1,'2016-02-29 22:43:39','2016-02-29 22:43:39'),(479,'OWID_PYA','Polynesia',1,'2016-02-29 22:43:41','2016-02-29 22:43:41'),(483,'OWID_NLC','Caribbean Netherlands',1,'0000-00-00 00:00:00','0000-00-00 00:00:00');
/*!40000 ALTER TABLE `entities` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2016-08-05 14:18:55
-- MySQL dump 10.13  Distrib 5.5.47, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: forge
-- ------------------------------------------------------
-- Server version	5.5.47-0ubuntu0.14.04.1-log

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
-- Dumping data for table `licenses`
--

LOCK TABLES `licenses` WRITE;
/*!40000 ALTER TABLE `licenses` DISABLE KEYS */;
INSERT INTO `licenses` VALUES (1,'Creative Commons','The author Max Roser licensed this visualization under a <a class=\"licence-link\" href=\"http://creativecommons.org/licenses/by-sa/4.0/deed.en_US\" target=\"_blank\">CC BY-SA license</a>. You are welcome to share but please refer to its source where you can find more information: *data-entry*','0000-00-00 00:00:00','2016-03-16 19:45:23');
/*!40000 ALTER TABLE `licenses` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2016-08-05 14:18:55
INSERT INTO users (name, email, password) VALUES ('admin', 'admin@example.com', '$2y$10$T4Ye2Yce8GkRPpfCw8J0X.NwjHeu4FOLRMKVjAyT78cpU53YKyZSy');
